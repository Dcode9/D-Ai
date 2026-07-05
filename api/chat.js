// Standard Node.js Serverless Function (Bypasses some Edge WAF rules)
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
  const messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  return {
    ...incomingBody,
    model: normalizeChatModel(incomingBody.model),
    messages: messages.map(normalizeMessageForCerebras)
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
