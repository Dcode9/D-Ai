// Standard Node.js Serverless Function (Bypasses Edge WAF rules)
const UPLOADED_IMAGE_RE = /\[UPLOADED_IMAGE:\s*([^\]]+)\]/gi;
const UPLOADED_IMAGE_ASPECT_RATIO_RE = /\[UPLOADED_IMAGE_ASPECT_RATIO:\s*([^\]]+)\]/gi;

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
    .replace(UPLOADED_IMAGE_ASPECT_RATIO_RE, '[image aspect ratio attached]')
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
5. If the user explicitly asks to generate images or interactive widgets, use clean directives:
   - Image: <<GENERATE_IMAGE: prompt | aspect_ratio | filename_slug>>
   - Interactive UI: \`\`\`dai-ui chart\`\`\` or \`\`\`dai-ui demo\`\`\` or \`\`\`dai-ui pythagoras\`\`\`
6. If the user explicitly shares personal facts, you may optionally append:
   [MEMORY_UPDATE: {"add": ["User's name is Dhairya", "User is in 10th standard"]}]
7. Do not output repetitive disclaimers or forced meta-commentary. Keep your tone helpful, professional, and objective.`;

  const extraSystem = systemMessages.map(m => String(m.content || '')).filter(Boolean).join('\n\n');
  return `${baseSystemPrompt}\n\n${extraSystem}`.trim();
}

async function callProviderAPI({ provider, apiKey, incomingBody }) {
  const messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  const otherMessages = messages.filter(m => m && m.role !== 'system');
  const fullSystemPrompt = buildSystemPrompt(messages);

  let endpoint = '';
  let candidateModels = [];
  let headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) D-Ai/2.0',
  };

  if (provider === 'inception') {
    endpoint = process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1/chat/completions';
    candidateModels = ['mercury-2', 'mercury-2-coder', 'mercury'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'cerebras') {
    endpoint = 'https://api.cerebras.ai/v1/chat/completions';
    candidateModels = ['llama-3.3-70b', 'llama3.1-8b', 'llama3.1-70b', 'llama-3.2-3b'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'cloudflare') {
    const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
    endpoint = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`;
    candidateModels = ['@cf/meta/llama-3.3-70b-instruct', '@cf/meta/llama-3.1-8b-instruct'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let lastRes = null;
  let lastModelUsed = '';

  for (const model of candidateModels) {
    lastModelUsed = model;
    try {
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
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000)
      });

      if (response.ok) {
        return { response, provider, model };
      }

      const errText = await response.text().catch(() => '');
      console.warn(`[D-Ai API] ${provider} (${model}) returned HTTP ${response.status}: ${errText.slice(0, 150)}. Trying next model...`);
      lastRes = response;
    } catch (modelErr) {
      console.warn(`[D-Ai API] ${provider} (${model}) network error:`, modelErr.message);
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

  const inceptionKey = (process.env.INCEPTION_API || '').trim();
  const cerebrasKey = (process.env.CEREBRAS_API_KEY || '').trim();
  const cfKey = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const cfAccount = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();

  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      has_inception: !!inceptionKey,
      has_cerebras: !!cerebrasKey,
      has_cloudflare: !!(cfKey && cfAccount),
      primary_provider: inceptionKey ? 'Inception (Mercury-2)' : (cerebrasKey ? 'Cerebras (Llama 3.3)' : 'Cerebras')
    });
  }

  if (req.method === 'POST') {
    try {
      const requestedProvider = req.body?.provider;

      // Assemble tiered provider cascade
      const providersToTry = [];

      if (requestedProvider === 'inception' && inceptionKey) {
        providersToTry.push({ provider: 'inception', apiKey: inceptionKey });
      } else if (requestedProvider === 'cerebras' && cerebrasKey) {
        providersToTry.push({ provider: 'cerebras', apiKey: cerebrasKey });
      }

      // Add all available authenticated providers in sequence
      if (cerebrasKey && !providersToTry.some(p => p.provider === 'cerebras')) {
        providersToTry.push({ provider: 'cerebras', apiKey: cerebrasKey });
      }
      if (inceptionKey && !providersToTry.some(p => p.provider === 'inception')) {
        providersToTry.push({ provider: 'inception', apiKey: inceptionKey });
      }
      if (cfKey && cfAccount) {
        providersToTry.push({ provider: 'cloudflare', apiKey: cfKey });
      }

      if (providersToTry.length === 0) {
        return res.status(500).json({ 
          error: 'Configuration Error: Missing CEREBRAS_API_KEY or INCEPTION_API in environment variables.' 
        });
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
            console.log(`[D-Ai API] Provider ${p.provider} SUCCESS (200) using ${result.model}`);
            break;
          } else if (result.response) {
            const errBody = await result.response.text().catch(() => '');
            lastError = `Provider ${p.provider} (${result.response.status}): ${errBody.slice(0, 150)}`;
            console.warn(`[D-Ai API] Provider ${p.provider} failed:`, lastError);
          }
        } catch (callErr) {
          lastError = `Provider ${p.provider} exception: ${callErr.message}`;
          console.warn(`[D-Ai API] Provider ${p.provider} exception:`, callErr.message);
        }
      }

      if (!activeResponse) {
        console.error('[D-Ai API Critical] All providers failed:', lastError);
        return res.status(502).json({ error: lastError || 'All AI model providers failed to respond.' });
      }

      // Handle non-streaming JSON response
      if (req.body?.stream === false) {
        const json = await activeResponse.json();
        return res.status(200).json(json);
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
