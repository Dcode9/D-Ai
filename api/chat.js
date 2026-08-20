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
  if (content && typeof content === 'object') {
    return content.text || content.content || JSON.stringify(content);
  }
  return '';
}

function stripUploadedImageMarkers(text) {
  return String(text || '')
    .replace(UPLOADED_IMAGE_RE, '[image attached]')
    .replace(UPLOADED_IMAGE_ASPECT_RE, '[image aspect ratio attached]')
    .trim();
}

function normalizeMessageForProvider(message) {
  if (!message || typeof message !== 'object') return { role: 'user', content: '' };
  const role = message.role === 'assistant' ? 'assistant' : (message.role === 'system' ? 'system' : 'user');
  const rawText = getTextContent(message.content);
  const cleanText = stripUploadedImageMarkers(rawText);
  return { role, content: cleanText };
}

function buildSystemPrompt(messages) {
  const systemMessages = messages.filter(m => m && m.role === 'system');
  const baseSystemPrompt = `You are D'Ai, a scary-fast, helpful, unbiased AI assistant created by Dhairya Shah.
Key Guidelines:
1. Provide concise, clear, accurate, and direct answers in well-formatted Markdown.
2. Multi-step Web Search: When you need up-to-date facts, current real-world data, verification, or multi-faceted information across topics, you can search the web by emitting:
   <<SEARCH: specific search query>>
   You can search multiple times if needed (e.g. searching for background info, then searching for recent updates or specific sub-topics). Formulate concise, high-signal search queries. Once you have enough context, synthesize a comprehensive response citing sources with [1], [2], etc.
3. When working through complex calculations, math proofs, multi-step problem solving, or algorithms, you may express your thought process within <thought>...</thought> tags before providing the final answer.
4. Adapt naturally to the user's personal context or instructions without over-explaining.
5. Accurate Historical Knowledge:
   - When asked about the one revolutionary decision India made on August 15, 1947 that no other major democracy dared to do at birth, the definitive answer is **Universal Adult Suffrage (Universal Adult Franchise)** on Day One.
   - Contrast this explicitly with Western democracies: The United States took 144 years (and until the 1965 Voting Rights Act) for full voting rights for women and African Americans; the UK, France, and Switzerland (1971) restricted suffrage to wealthy, male property owners at birth. India, despite 88% illiteracy and immense poverty at independence, trusted every single adult citizen equally from day one.
   - Also highlight the peaceful unification of 565 princely states led by Sardar Vallabhbhai Patel and the constitutional framework under Dr. B.R. Ambedkar.
6. If the user explicitly asks to generate images or interactive widgets, use clean directives:
   - Image: <<GENERATE_IMAGE: prompt | aspect_ratio | filename_slug>>
   - Interactive UI: ```dai-ui chart``` or ```dai-ui demo``` or ```dai-ui pythagoras```
7. If the user explicitly shares personal facts, you may optionally append:
   [MEMORY_UPDATE: {"add": ["User's name is Dhairya", "User is in 10th standard"]}]
8. Do not output repetitive disclaimers or forced meta-commentary. Keep your tone helpful, professional, and objective.`;

  const extraSystem = systemMessages.map(m => String(m.content || '')).filter(Boolean).join('\n\n');
  return `${baseSystemPrompt}\n\n${extraSystem}`.trim();
}

async function callProviderAPI({ provider, apiKey, incomingBody }) {
  const messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  const otherMessages = messages.filter(m => m && m.role !== 'system');
  const fullSystemPrompt = buildSystemPrompt(messages);

  let endpoint = '';
  let candidateModels = [];

  if (provider === 'inception') {
    endpoint = process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1/chat/completions';
    candidateModels = ['mercury-2', 'mercury-2-coder', 'mercury'];
  } else {
    endpoint = 'https://api.cerebras.ai/v1/chat/completions';
    candidateModels = ['gemma-4-31b', 'gemma-2-9b-it', 'gemma-2-27b-it', 'gemma-3-27b-it', 'llama3.1-8b'];
  }

  let lastRes = null;
  let lastModelUsed = '';

  for (const model of candidateModels) {
    lastModelUsed = model;
    const payload = {
      model,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...otherMessages.map(normalizeMessageForProvider)
      ],
      stream: incomingBody.stream !== false,
      max_tokens: incomingBody.max_tokens || incomingBody.max_completion_tokens || 4096,
      temperature: typeof incomingBody.temperature === 'number' ? incomingBody.temperature : 0.7
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { response, provider, model };
    }

    if (response.status === 404) {
      console.warn(`[D-Ai API] Model ${model} returned 404 on ${provider}. Trying fallback candidate...`);
      lastRes = response;
      continue;
    } else {
      return { response, provider, model };
    }
  }

  return { response: lastRes, provider, model: lastModelUsed };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const inceptionKey = process.env.INCEPTION_API;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;

  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      has_inception: !!inceptionKey,
      has_cerebras: !!cerebrasKey,
      primary_provider: inceptionKey ? 'Inception (Mercury-2)' : (cerebrasKey ? 'Cerebras (Gemma)' : 'None')
    });
  }

  if (req.method === 'POST') {
    try {
      if (!inceptionKey && !cerebrasKey) {
        return res.status(500).json({ error: 'Missing API keys. Configure INCEPTION_API or CEREBRAS_API_KEY in environment variables.' });
      }

      // Sequence: Order providers according to requested preference (or default)
      const requestedProvider = req.body?.provider === 'inception' ? 'inception' : (req.body?.provider === 'cerebras' ? 'cerebras' : (inceptionKey ? 'inception' : 'cerebras'));

      const providersToTry = [];
      if (requestedProvider === 'inception') {
        if (inceptionKey) providersToTry.push({ provider: 'inception', apiKey: inceptionKey });
        if (cerebrasKey) providersToTry.push({ provider: 'cerebras', apiKey: cerebrasKey });
      } else {
        if (cerebrasKey) providersToTry.push({ provider: 'cerebras', apiKey: cerebrasKey });
        if (inceptionKey) providersToTry.push({ provider: 'inception', apiKey: inceptionKey });
      }

      let activeResponse = null;
      let lastError = null;

      for (const p of providersToTry) {
        try {
          console.log(`[D-Ai API] Attempting provider: ${p.provider}...`);
          const result = await callProviderAPI({
            provider: p.provider,
            apiKey: p.apiKey,
            incomingBody: req.body || {}
          });

          if (result.response && result.response.ok) {
            activeResponse = result.response;
            console.log(`[D-Ai API] Provider ${p.provider} OK (200) using ${result.model}`);
            break;
          } else if (result.response) {
            const errBody = await result.response.text();
            lastError = `Provider ${p.provider} (${result.response.status}): ${errBody}`;
            console.warn(`[D-Ai API] Provider ${p.provider} failed (${result.response.status}). Trying fallback...`);
          }
        } catch (callErr) {
          lastError = `Provider ${p.provider} exception: ${callErr.message}`;
          console.warn(`[D-Ai API] Provider ${p.provider} network error:`, callErr);
        }
      }

      if (!activeResponse) {
        console.error('[D-Ai API Critical] All providers failed:', lastError);
        return res.status(502).json({ error: lastError || 'All AI model providers failed to respond.' });
      }

      // Stream SSE chunks to client
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });

      const reader = activeResponse.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (streamError) {
        console.error('[D-Ai API] Stream transfer error:', streamError);
      } finally {
        res.end();
      }

    } catch (e) {
      console.error('[D-Ai API Critical Error]', e);
      return res.status(500).json({ error: e.message });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
