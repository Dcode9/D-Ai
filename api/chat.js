// Standard Node.js Serverless Function (Bypasses Edge WAF rules)
const UPLOADED_IMAGE_RE = /\[UPLOADED_IMAGE:\s*([^\]]+)\]/gi;
const UPLOADED_IMAGE_MARKER_RE = /\[UPLOADED_IMAGE:\s*([^\]]+)\]/i;
const UPLOADED_IMAGE_ASPECT_RE = /\[UPLOADED_IMAGE_ASPECT_RATIO:\s*([^\]]+)\]/gi;
const CONTROL_LINE_RE = /^\s*\/\/([a-z0-9_-]+)\s*:?\s*(.*)$/i;
const DEFAULT_INCEPTION_MODEL = 'mercury-2';
const DEFAULT_CEREBRAS_MODEL = 'gemma-4-31b';

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
  if (!value || value === 'llama3.1-8b' || value === 'gpt-oss-120b') return DEFAULT_CEREBRAS_MODEL;
  return value;
}

function hasInlineImage(content) {
  if (typeof content === 'string') {
    return (
      UPLOADED_IMAGE_MARKER_RE.test(content) ||
      /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(content)
    );
  }

  if (!Array.isArray(content)) return false;
  return content.some((part) => {
    if (typeof part === 'string') return hasInlineImage(part);
    if (!part || typeof part !== 'object') return false;
    if (part.type === 'image_url') return true;
    if (part.type === 'image' || part.type === 'input_image') return true;
    if (part.type === 'text') return hasInlineImage(part.text || '');
    return false;
  });
}

function hasImageAttachment(messages) {
  return Array.isArray(messages) && messages.some((message) => {
    if (!message || message.role !== 'user') return false;
    return hasInlineImage(message.content);
  });
}

function sanitizeUserContent(content) {
  if (typeof content === 'string') {
    return content
      .split('\n')
      .filter((line) => !CONTROL_LINE_RE.test(line))
      .join('\n')
      .trim();
  }

  if (!Array.isArray(content)) return content;
  return content.map((part) => {
    if (typeof part === 'string') return sanitizeUserContent(part);
    if (part?.type === 'text') return { ...part, text: sanitizeUserContent(part.text || '') };
    return part;
  });
}

function parseControls(messages) {
  const controls = {
    hasDevSecret: false,
    forceProvider: null,
    fallbackEnabled: true,
    thinkingEnabled: false,
    webSearchQuery: ''
  };

  if (!Array.isArray(messages)) return controls;
  const latestUser = [...messages].reverse().find((message) => message?.role === 'user');
  const text = getTextContent(latestUser?.content || '');
  if (!text) return controls;

  const expectedSecret = process.env.DEV_MODEL_CONTROL_SECRET;

  for (const rawLine of text.split('\n')) {
    const match = rawLine.match(CONTROL_LINE_RE);
    if (!match) continue;

    const key = String(match[1] || '').toLowerCase();
    const value = String(match[2] || '').trim();
    if (key === 'dev-secret' && expectedSecret && value && value === expectedSecret) {
      controls.hasDevSecret = true;
      continue;
    }

    if (key === 'web-search' || key === 'websearch' || key === 'search') {
      controls.webSearchQuery = value || controls.webSearchQuery;
      continue;
    }

    if (!controls.hasDevSecret) continue;

    if (key === 'model' || key === 'switch-model') {
      const normalized = value.toLowerCase();
      if (normalized === 'inception' || normalized === 'mercury') controls.forceProvider = 'inception';
      if (normalized === 'cerebras') controls.forceProvider = 'cerebras';
    }

    if (key === 'fallback') {
      if (/^(off|false|0|no)$/i.test(value)) controls.fallbackEnabled = false;
      if (/^(on|true|1|yes)$/i.test(value)) controls.fallbackEnabled = true;
    }

    if (key === 'thinking') {
      if (/^(on|true|1|yes)$/i.test(value)) controls.thinkingEnabled = true;
      if (/^(off|false|0|no)$/i.test(value)) controls.thinkingEnabled = false;
    }
  }

  return controls;
}

function sanitizeIncomingBody(incomingBody) {
  const body = incomingBody && typeof incomingBody === 'object' ? { ...incomingBody } : {};
  const sourceMessages = Array.isArray(body.messages) ? body.messages : [];
  body.messages = sourceMessages.map((message) => {
    if (!message || typeof message !== 'object') return message;
    if (message.role !== 'user') return message;
    return { ...message, content: sanitizeUserContent(message.content) };
  });
  return body;
}

async function runWebSearch(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (!process.env.WEB_SEARCH_API) return null;

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.WEB_SEARCH_API,
        query: q,
        search_depth: 'advanced',
        max_results: 6,
        include_answer: true,
        include_images: false
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const snippets = Array.isArray(data.results)
      ? data.results
          .slice(0, 5)
          .map((item, index) => `${index + 1}. ${item.title || 'Result'} — ${item.url || ''}\n${item.content || item.snippet || ''}`)
          .join('\n\n')
      : '';

    if (!snippets && !data.answer) return null;
    return `[WEB_SEARCH_RESULTS]\nQuery: ${q}\n\nSummary: ${data.answer || 'No summary available.'}\n\nSources:\n${snippets}`;
  } catch (error) {
    return null;
  }
}

async function prepareCerebrasBody(incomingBody, controls = {}) {
  const messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  const systemMessages = messages.filter((m) => m && m.role === 'system');
  const otherMessages = messages.filter((m) => m && m.role !== 'system');

  const baseSystemPrompt = `You are D'Ai, a scary-fast, helpful, unbiased AI assistant created by Dhairya Shah.
Key Guidelines:
1. Provide concise, clear, accurate, and direct answers in well-formatted Markdown.
2. Adapt naturally to the user's personal context or instructions without over-explaining.
3. Accurate Historical Knowledge:
   - When asked about the one revolutionary decision India made on August 15, 1947 that no other major democracy dared to do at birth, the definitive answer is **Universal Adult Suffrage (Universal Adult Franchise)** on Day One.
   - Contrast this explicitly with Western democracies: The United States took 144 years (and until the 1965 Voting Rights Act) for full voting rights for women and African Americans; the UK, France, and Switzerland (1971) restricted suffrage to wealthy, male property owners at birth. India, despite 88% illiteracy and immense poverty at independence, trusted every single adult citizen equally from day one.
   - Also highlight the peaceful unification of 565 princely states led by Sardar Vallabhbhai Patel and the constitutional framework under Dr. B.R. Ambedkar.
4. If the user explicitly asks to generate media or interactive widgets, use clean fenced directives:
   - Image: <<GENERATE_IMAGE: prompt | 16:9 | 1024x1024>>
   - Video: <<GENERATE_VIDEO: prompt | 16:9 | 4>>
   - Music: <<GENERATE_MUSIC: prompt | 15>>
   - Interactive UI: \`\`\`dai-ui chart\`\`\`
5. If the user explicitly shares personal facts (e.g. name, grade/standard, occupation, interests), you may optionally append a directive on its own final line:
[MEMORY_UPDATE: {"add": ["User's name is Dhairya", "User is in 10th standard"]}]
6. Do not output repetitive disclaimers or forced meta-commentary. Keep your tone helpful, professional, and objective.`;

  const extraSystem = systemMessages.map((m) => String(m.content || '')).filter(Boolean).join('\n\n');
  const fullSystemPrompt = `${baseSystemPrompt}\n\n${extraSystem}`.trim();
  const thinkingPrompt = controls.thinkingEnabled
    ? '\n7. Use deliberate internal reasoning before answering, then return only the final concise answer.'
    : '';

  const webSearchResult = controls.webSearchResult ? [{ role: 'system', content: controls.webSearchResult }] : [];

  return {
    ...incomingBody,
    model: normalizeChatModel(incomingBody.model) || DEFAULT_CEREBRAS_MODEL,
    messages: [
      { role: 'system', content: `${fullSystemPrompt}${thinkingPrompt}`.trim() },
      ...webSearchResult,
      ...otherMessages.map(normalizeMessageForCerebras)
    ]
  };
}

async function callCerebras(cerebrasBody) {
  if (!process.env.CEREBRAS_API_KEY) {
    throw new Error('Missing CEREBRAS_API_KEY env var');
  }

  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `******
    },
    body: JSON.stringify(cerebrasBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cerebras failed (${response.status}): ${errorText}`);
  }

  return response;
}

async function callInception(incomingBody, controls = {}) {
  if (!process.env.INCEPTION_API_KEY) {
    throw new Error('Missing INCEPTION_API_KEY env var');
  }

  const body = {
    ...incomingBody,
    model: DEFAULT_INCEPTION_MODEL,
    stream: false
  };

  if (controls.webSearchResult) {
    body.messages = [
      ...(Array.isArray(incomingBody.messages) ? incomingBody.messages : []),
      { role: 'system', content: controls.webSearchResult }
    ];
  }

  const response = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `******
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inception failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

function getMessageTextFromCompletion(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part?.type === 'text' ? part.text || '' : part?.text || ''))
      .join('');
  }
  return '';
}

function sendSseDelta(res, text) {
  const data = JSON.stringify({
    choices: [
      {
        delta: { content: text }
      }
    ]
  });
  res.write(`data: ${data}\n\n`);
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
      env_check: {
        inception: !!process.env.INCEPTION_API_KEY,
        cerebras: !!process.env.CEREBRAS_API_KEY
      }
    });
  }

  // 4. Main Logic
  if (req.method === 'POST') {
    try {
      const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const safeBody = sanitizeIncomingBody(req.body || {});
      const controls = parseControls(incomingMessages);
      const imageAttached = hasImageAttachment(incomingMessages);
      const webSearchResult = controls.webSearchQuery ? await runWebSearch(controls.webSearchQuery) : null;

      let provider = imageAttached ? 'cerebras' : 'inception';
      if (controls.forceProvider) provider = controls.forceProvider;
      if (imageAttached) provider = 'cerebras';

      // Stream the response back
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });

      try {
        if (provider === 'inception') {
          try {
            const inceptionPayload = await callInception(safeBody, { webSearchResult });
            const content = getMessageTextFromCompletion(inceptionPayload);
            if (content) sendSseDelta(res, content);
            res.write('data: [DONE]\n\n');
            return res.end();
          } catch (inceptionError) {
            if (!controls.fallbackEnabled) throw inceptionError;
            const cerebrasBody = await prepareCerebrasBody(safeBody, {
              thinkingEnabled: controls.thinkingEnabled,
              webSearchResult
            });
            const fallbackResponse = await callCerebras(cerebrasBody);
            const reader = fallbackResponse.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            return res.end();
          }
        }

        const cerebrasBody = await prepareCerebrasBody(safeBody, {
          thinkingEnabled: controls.thinkingEnabled,
          webSearchResult
        });
        const response = await callCerebras(cerebrasBody);
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        return res.end();
      } catch (streamError) {
        const message = streamError instanceof Error ? streamError.message : 'Upstream model error';
        sendSseDelta(res, `I hit an upstream model error: ${message}`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
