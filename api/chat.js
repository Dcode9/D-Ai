// Standard Node.js Serverless Function (Bypasses Edge WAF rules)
const UPLOADED_IMAGE_RE = /\[UPLOADED_IMAGE:\s*([^\]]+)\]/gi;
const UPLOADED_IMAGE_ASPECT_RE = /\[UPLOADED_IMAGE_ASPECT_RATIO:\s*([^\]]+)\]/gi;

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

function stripUploadedImageMarkers(text) {
  return String(text || '')
    .replace(UPLOADED_IMAGE_RE, '[image attached]')
    .replace(UPLOADED_IMAGE_ASPECT_RE, '[image aspect ratio attached]')
    .trim();
}

function contentToCerebrasParts(content) {
  const text = getTextContent(content);
  const parts = [];
  const cleanedText = stripUploadedImageMarkers(text);
  if (cleanedText) {
    parts.push({ type: 'text', text: cleanedText });
  }

  const imageMatches = [];
  let match;
  UPLOADED_IMAGE_RE.lastIndex = 0;
  while ((match = UPLOADED_IMAGE_RE.exec(text)) && imageMatches.length < 5) {
    const url = match[1].trim();
    if (/^data:image\/(png|jpe?g);base64,/i.test(url)) {
      imageMatches.push(url);
    }
  }

  for (const url of imageMatches) {
    parts.push({ type: 'image_url', image_url: { url } });
  }

  return imageMatches.length ? parts : cleanedText;
}

function normalizeMessageForCerebras(message) {
  if (!message || typeof message !== 'object') return message;
  if (message.role === 'user') {
    return { ...message, content: contentToCerebrasParts(message.content) };
  }
  if (typeof message.content === 'string') {
    return { ...message, content: stripUploadedImageMarkers(message.content) };
  }
  if (Array.isArray(message.content)) {
    return {
      ...message,
      content: message.content.map((part) => {
        if (part?.type === 'text') return { ...part, text: stripUploadedImageMarkers(part.text) };
        return part;
      })
    };
  }
  return message;
}

function normalizeChatModel(model) {
  const value = typeof model === 'string' ? model.trim() : '';
  if (!value || value === 'llama3.1-8b' || value === 'gpt-oss-120b') return 'gemma-4-31b';
  return value;
}

async function prepareCerebrasBody(incomingBody) {
  let messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  
  const systemMessages = messages.filter(m => m && m.role === 'system');
  const otherMessages = messages.filter(m => m && m.role !== 'system');

  const baseSystemPrompt = `You are D'Ai, a scary-fast, helpful, unbiased AI assistant created by Dhairya Shah.
Key Guidelines:
1. Provide concise, clear, accurate, and direct answers in well-formatted Markdown.
2. Adapt naturally to the user's personal context or instructions without over-explaining.
3. If the user explicitly asks to generate media or interactive widgets, use clean fenced directives:
   - Image: <<GENERATE_IMAGE: prompt | 16:9 | 1024x1024>>
   - Video: <<GENERATE_VIDEO: prompt | 16:9 | 4>>
   - Music: <<GENERATE_MUSIC: prompt | 15>>
   - Interactive UI: \`\`\`dai-ui chart\`\`\`
4. If the user explicitly shares personal facts (e.g. name, grade/standard, occupation, interests), you may optionally append a directive on its own final line:
   [MEMORY_UPDATE: {"add": ["User's name is Dhairya", "User is in 10th standard"]}]
5. Do not output repetitive disclaimers or forced meta-commentary. Keep your tone helpful, professional, and objective.`;

  const extraSystem = systemMessages.map(m => String(m.content || '')).filter(Boolean).join('\n\n');
  const fullSystemPrompt = `${baseSystemPrompt}\n\n${extraSystem}`.trim();

  return {
    ...incomingBody,
    model: normalizeChatModel(incomingBody.model),
    messages: [
      { role: 'system', content: fullSystemPrompt },
      ...otherMessages.map(normalizeMessageForCerebras)
    ]
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
