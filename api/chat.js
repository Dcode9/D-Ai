// Standard Node.js Serverless Function (Bypasses some Edge WAF rules)
const UPLOADED_IMAGE_RE = /\[UPLOADED_IMAGE:\s*([^\]]+)\]/gi;

function getTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text') return part.text || '';
      return '';
    }).join(' ');
  }
  return '';
}

function cleanUploadedImageMarkers(content) {
  if (typeof content === 'string') {
    return content.replace(UPLOADED_IMAGE_RE, '[image attached]');
  }
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part?.type === 'text') {
        return { ...part, text: (part.text || '').replace(UPLOADED_IMAGE_RE, '[image attached]') };
      }
      return part;
    });
  }
  return content;
}

function collectUploadedImages(messages) {
  const found = [];
  for (const message of messages || []) {
    const text = getTextContent(message.content);
    let match;
    UPLOADED_IMAGE_RE.lastIndex = 0;
    while ((match = UPLOADED_IMAGE_RE.exec(text))) {
      found.push({
        url: match[1].trim(),
        message
      });
    }
  }
  return found;
}


function normalizeChatModel(model) {
  const value = typeof model === 'string' ? model.trim() : '';
  if (!value || value === 'llama3.1-8b') return 'gpt-oss-120b';
  return value;
}

function shouldUseVision(latestText, hasImageOnLatestTurn, hasPriorImage) {
  if (hasImageOnLatestTurn) return true;
  if (!hasPriorImage) return false;
  return /\b(image|photo|picture|pic|screenshot|uploaded|attachment|visual|look|see|describe|what is this|what's this|in it|about it)\b/i.test(latestText);
}

async function describeImageWithPollinations({ apiKey, imageUrl, userText }) {
  const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-scout',
      stream: false,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Describe the image in rich, objective detail for another assistant. Include visible objects, people, text, layout, colors, actions, notable context, and any details relevant to the user request. Do not answer the user directly.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `User request: ${userText || 'Describe this image.'}`
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pollinations vision error (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || '').join('\n').trim();
  }
  return '';
}

async function prepareCerebrasBody(incomingBody) {
  const messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  const latestUserIndex = messages.map((m) => m.role).lastIndexOf('user');
  const latestUser = latestUserIndex >= 0 ? messages[latestUserIndex] : null;
  const latestText = getTextContent(latestUser?.content || '');
  const uploadedImages = collectUploadedImages(messages);
  const latestImages = latestUser ? collectUploadedImages([latestUser]) : [];
  const shouldDescribe = shouldUseVision(latestText, latestImages.length > 0, uploadedImages.length > 0);

  let finalMessages = messages.map((message) => ({
    ...message,
    content: cleanUploadedImageMarkers(message.content)
  }));

  if (shouldDescribe) {
    const pollinationsKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;
    if (!pollinationsKey) {
      throw new Error('Missing POLLINATIONS_API env var for vision requests');
    }

    const imageUrl = (latestImages[latestImages.length - 1] || uploadedImages[uploadedImages.length - 1])?.url;
    const imageDescription = await describeImageWithPollinations({
      apiKey: pollinationsKey,
      imageUrl,
      userText: latestText.replace(UPLOADED_IMAGE_RE, '').trim()
    });

    if (imageDescription) {
      finalMessages.splice(Math.max(latestUserIndex, 0), 0, {
        role: 'system',
        content: "Private vision analysis from Pollinations model 'llama-scout'. Use this as visual context to answer the user's request. Do not mention this analysis pass, the vision model, or internal model handoff unless the user explicitly asks about system internals.\n\n" + imageDescription
      });
    }
  }

  return {
    ...incomingBody,
    model: normalizeChatModel(incomingBody.model),
    messages: finalMessages
  };
}

export default async function handler(req, res) {
  // 1. Set Robust CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Health Check
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      env_check: !!process.env.CEREBRAS_API_KEY 
    });
  }

  // 4. Main Logic
  if (req.method === 'POST') {
    try {
      if (!process.env.CEREBRAS_API_KEY) {
        return res.status(500).json({ error: 'Missing CEREBRAS_API_KEY env var' });
      }

      const cerebrasBody = await prepareCerebrasBody(req.body || {});

      // Call Cerebras
      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify(cerebrasBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }

      // Stream the response back
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });

      const reader = response.body.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value); // Write chunks directly
        }
      } catch (streamError) {
        console.error('Stream Error:', streamError);
      } finally {
        res.end();
      }

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
