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

function contentToProviderParts(content) {
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

function normalizeMessageForProvider(message) {
  if (!message || typeof message !== 'object') return message;
  if (message.role === 'user') {
    return { ...message, content: contentToProviderParts(message.content) };
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
  if (!value || value === 'llama3.1-8b' || value === 'gpt-oss-120b') {
    return process.env.INCEPTION_API ? 'mercury' : 'gemma-4-31b';
  }
  return value;
}

async function prepareRequestBody(incomingBody) {
  let messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  
  const systemMessages = messages.filter(m => m && m.role === 'system');
  const otherMessages = messages.filter(m => m && m.role !== 'system');

  const baseSystemPrompt = `You are D'Ai, a scary-fast, helpful, unbiased AI assistant created by Dhairya Shah.
Key Guidelines:
1. Provide concise, clear, accurate, and direct answers in well-formatted Markdown.
2. Multi-step Web Search: When you need up-to-date facts, current real-world data, verification, or multi-faceted information across topics, you can search the web by emitting:
   <<SEARCH: specific search query>>
   You can search multiple times if needed (e.g. searching for background info, then searching for recent updates or specific sub-topics). Formulate concise, high-signal search queries. Once you have enough context, synthesize a comprehensive response citing sources with [1], [2], etc.
3. Adapt naturally to the user's personal context or instructions without over-explaining.
4. Accurate Historical Knowledge:
   - When asked about the one revolutionary decision India made on August 15, 1947 that no other major democracy dared to do at birth, the definitive answer is **Universal Adult Suffrage (Universal Adult Franchise)** on Day One.
   - Contrast this explicitly with Western democracies: The United States took 144 years (and until the 1965 Voting Rights Act) for full voting rights for women and African Americans; the UK, France, and Switzerland (1971) restricted suffrage to wealthy, male property owners at birth. India, despite 88% illiteracy and immense poverty at independence, trusted every single adult citizen equally from day one.
   - Also highlight the peaceful unification of 565 princely states led by Sardar Vallabhbhai Patel and the constitutional framework under Dr. B.R. Ambedkar.
5. If the user explicitly asks to generate media or interactive widgets, use clean fenced directives:
   - Image: <<GENERATE_IMAGE: prompt | 16:9 | 1024x1024>>
   - Video: <<GENERATE_VIDEO: prompt | 16:9 | 4>>
   - Music: <<GENERATE_MUSIC: prompt | 15>>
   - Interactive UI: \`\`\`dai-ui chart\`\`\`
6. If the user explicitly shares personal facts (e.g. name, grade/standard, occupation, interests), you may optionally append:
   [MEMORY_UPDATE: {"add": ["User's name is Dhairya", "User is in 10th standard"]}]
7. Do not output repetitive disclaimers or forced meta-commentary. Keep your tone helpful, professional, and objective.`;

  const extraSystem = systemMessages.map(m => String(m.content || '')).filter(Boolean).join('\n\n');
  const fullSystemPrompt = `${baseSystemPrompt}\n\n${extraSystem}`.trim();

  const payload = {
    ...incomingBody,
    model: normalizeChatModel(incomingBody.model),
    messages: [
      { role: 'system', content: fullSystemPrompt },
      ...otherMessages.map(normalizeMessageForProvider)
    ]
  };

  // API-level thinking / reasoning parameters (for Cerebras and Inception / OpenAI-compatible APIs)
  if (incomingBody.thinking) {
    payload.reasoning_effort = incomingBody.reasoning_effort || 'medium';
    payload.thinking = { type: 'enabled', budget_tokens: incomingBody.budget_tokens || 2048 };
  }

  return payload;
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
  const apiKey = process.env.INCEPTION_API || process.env.CEREBRAS_API_KEY;
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      env_check: !!apiKey,
      provider: process.env.INCEPTION_API ? 'Inception (Mercury)' : 'Cerebras'
    });
  }

  // 4. Main Logic
  if (req.method === 'POST') {
    try {
      if (!apiKey) {
        return res.status(500).json({ error: 'Missing INCEPTION_API or CEREBRAS_API_KEY env var' });
      }

      const requestBody = await prepareRequestBody(req.body || {});
      
      // Determine provider endpoint: Inception API for Mercury model or Cerebras API
      const endpoint = process.env.INCEPTION_API
        ? (process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1/chat/completions')
        : 'https://api.cerebras.ai/v1/chat/completions';

      // Call Model API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
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
