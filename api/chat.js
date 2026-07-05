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

async function fetchImageToBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to fetch image to base64', url, e);
    return null;
  }
}

async function cleanUploadedImageMarkers(content) {
  const text = getTextContent(content);

  const foundImages = [];
  let match;
  UPLOADED_IMAGE_RE.lastIndex = 0;
  while ((match = UPLOADED_IMAGE_RE.exec(text))) {
    foundImages.push(match[1].trim());
  }

  if (foundImages.length === 0) {
    return text;
  }

  // We have images, convert the message into an array format for Cerebras Vision
  const cleanedText = text
    .replace(UPLOADED_IMAGE_RE, '')
    .replace(UPLOADED_IMAGE_ASPECT_RE, '')
    .trim();

  const newContent = [];
  if (cleanedText) {
    newContent.push({ type: 'text', text: cleanedText });
  }

  // Natively support 1 image per message for simplicity, but we can do up to 5 per Cerebras docs
  for (const url of foundImages.slice(0, 5)) {
     const base64 = await fetchImageToBase64(url);
     if (base64) {
       newContent.push({
         type: 'image_url',
         image_url: { url: base64 }
       });
     }
  }

  // Fallback to text if image fetching failed for all
  if (newContent.length === 1 && newContent[0].type === 'text') {
      return cleanedText;
  }

  return newContent.length > 0 ? newContent : cleanedText;
}

function normalizeChatModel(model) {
  const value = typeof model === 'string' ? model.trim() : '';
  if (!value || value === 'llama3.1-8b' || value === 'gpt-oss-120b') return 'gemma-4-31b';
  return value;
}

async function prepareCerebrasBody(incomingBody) {
  const messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];

  let finalMessages = [];
  for (const message of messages) {
     finalMessages.push({
       ...message,
       content: await cleanUploadedImageMarkers(message.content)
     });
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
