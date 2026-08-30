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

function extractImageUrlFromMessage(message) {
  if (!message) return null;
  // 1. Check array content for image_url
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part?.type === 'image_url' && part.image_url?.url) {
        return part.image_url.url;
      }
      if (part?.type === 'image' && (part.url || part.data)) {
        return part.url || part.data;
      }
    }
  }
  // 2. Check string text content for [UPLOADED_IMAGE: url]
  const rawText = typeof message.content === 'string' ? message.content : getTextContent(message.content);
  const match = String(rawText || '').match(/\[UPLOADED_IMAGE:\s*([^\s\]]+)\]/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

function stripUploadedImageMarkers(text, isVision = false) {
  const replacement = isVision ? '' : '[User attached an image]';
  return String(text || '')
    .replace(/\[UPLOADED_IMAGE:\s*([^\s\]]+)\]/gi, replacement)
    .replace(/\[UPLOADED_IMAGE_ASPECT_RATIO:[^\]]+\]/gi, '')
    .trim();
}

function hasAnyVisionContent(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some(m => Boolean(extractImageUrlFromMessage(m)));
}

function normalizeMessageForProvider(message, isVision = false) {
  if (!message || typeof message !== 'object') return { role: 'user', content: '' };
  const role = message.role === 'assistant' ? 'assistant' : (message.role === 'system' ? 'system' : 'user');
  
  if (isVision && role === 'user') {
    const imgUrl = extractImageUrlFromMessage(message);
    const rawText = getTextContent(message.content);
    const cleanText = stripUploadedImageMarkers(rawText, true) || 'Please describe and analyze this image in detail.';
    
    if (imgUrl) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: cleanText },
          { type: 'image_url', image_url: { url: imgUrl } }
        ]
      };
    }
  }

  const rawText = getTextContent(message.content);
  const cleanText = stripUploadedImageMarkers(rawText, isVision) || (role === 'user' ? 'Hello' : '');
  return { role, content: cleanText };
}

function buildSystemPrompt(messages, isVision = false) {
  if (isVision) {
    return `You are D'Ai, a multimodal AI vision assistant powered by Qwen 3.6 27B.
Analyze any provided images with high precision, identifying all visible objects, text, equations, code, diagrams, charts, colors, people, and details.
Answer the user's questions about the image truthfully and directly based strictly on the actual visual content.`;
  }

  const systemMessages = messages.filter(m => m && m.role === 'system');
  const baseSystemPrompt = `You are D'Ai, a scary-fast, helpful, unbiased AI assistant created by Dhairya Shah.
Key Guidelines:
1. Provide concise, clear, accurate, and direct answers in well-formatted Markdown.
2. Multi-step Web Search: When you need up-to-date facts, current real-world data, verification, or multi-faceted information across topics, you can search the web by emitting:
   <<SEARCH: specific search query>>
   You can search multiple times if needed. Formulate concise, high-signal search queries. Once you have enough context, synthesize a comprehensive response citing sources with [1], [2], etc.
3. When working through complex calculations, math proofs, multi-step problem solving, or algorithms, express your thought process within <thought>...</thought> or <think>...</think> tags before providing the final answer.
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

async function callProviderAPI({ provider, apiKey, incomingBody, isVision = false }) {
  const messages = Array.isArray(incomingBody.messages) ? incomingBody.messages : [];
  const otherMessages = messages.filter(m => m && m.role !== 'system');
  const fullSystemPrompt = buildSystemPrompt(messages, isVision);

  let endpoint = '';
  let candidateModels = [];
  let headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) D-Ai/2.0',
  };

  if (provider === 'groq') {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    if (isVision) {
      candidateModels = incomingBody.model && incomingBody.model.includes('qwen')
        ? [incomingBody.model, 'qwen/qwen3.6-27b', 'qwen/qwen-3.6-27b', 'qwen-3.6-27b', 'qwen3.6-27b'] 
        : ['qwen/qwen3.6-27b', 'qwen/qwen-3.6-27b', 'qwen-3.6-27b', 'qwen3.6-27b'];
    } else if (incomingBody.compound || incomingBody.model === 'groq/compound' || incomingBody.model === 'groq/compound-mini') {
      candidateModels = ['groq/compound', 'groq/compound-mini', 'llama-3.3-70b-versatile'];
    } else if (incomingBody.model) {
      candidateModels = [incomingBody.model, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'qwen-2.5-32b'];
    } else {
      candidateModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'qwen-2.5-32b', 'gemma2-9b-it'];
    }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'inception') {
    endpoint = process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1/chat/completions';
    candidateModels = incomingBody.model ? [incomingBody.model, 'mercury-2', 'mercury-2-coder', 'mercury'] : ['mercury-2', 'mercury-2-coder', 'mercury'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'cloudflare') {
    const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
    endpoint = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`;
    candidateModels = ['@cf/meta/llama-3.3-70b-instruct', '@cf/meta/llama-3.1-8b-instruct'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let lastRes = null;
  let lastModelUsed = candidateModels[0] || '';

  for (const model of candidateModels) {
    lastModelUsed = model;
    try {
      const payload = {
        model,
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...otherMessages.map(m => normalizeMessageForProvider(m, isVision))
        ],
        stream: incomingBody.stream !== false,
        max_tokens: incomingBody.max_tokens || incomingBody.max_completion_tokens || 4096,
        temperature: typeof incomingBody.temperature === 'number' ? incomingBody.temperature : 0.7
      };

      // Pass-through tools and function calling parameters if provided
      if (Array.isArray(incomingBody.tools) && incomingBody.tools.length > 0) {
        payload.tools = incomingBody.tools;
        if (incomingBody.tool_choice) payload.tool_choice = incomingBody.tool_choice;
      }

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
      console.warn(`[D-Ai API] ${provider} (${model}) returned HTTP ${response.status}: ${errText.slice(0, 150)}. Trying next candidate...`);
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

  const inceptionKey = (process.env.INCEPTION_API || process.env.INCEPTION_API_KEY || process.env.INCEPTION_KEY || '').trim();
  const groqKey = (process.env.GROQ_API_KEY || process.env.GROQ_API || process.env.GROK_API_KEY || process.env.GROK_API || '').trim();
  const cfKey = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const cfAccount = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const reqId = req.headers['x-request-id'] || `chat_${Date.now().toString(36)}`;

  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      has_inception: !!inceptionKey,
      has_groq: !!groqKey,
      has_cloudflare: !!(cfKey && cfAccount),
      primary_provider: inceptionKey ? 'Inception (Mercury-2)' : (groqKey ? 'Groq (Llama 3.3 / Qwen)' : 'Groq')
    });
  }

  if (req.method === 'POST') {
    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

      // Input validation
      const MAX_MESSAGES = 200;
      const MAX_CONTENT_LENGTH = 50_000; // chars per message
      const MAX_TOTAL_MESSAGES_BYTES = 200_000; // aggregate safety
      if (messages.length === 0) {
        return res.status(400).json({ error: 'At least one message is required.' });
      }
      if (messages.length > MAX_MESSAGES) {
        return res.status(400).json({ error: `Too many messages in the request (limit ${MAX_MESSAGES}).` });
      }
      let totalSize = 0;
      for (const m of messages) {
        if (!m || typeof m !== 'object') {
          return res.status(400).json({ error: 'Each message must be an object with role and content.' });
        }
        if (!['user', 'assistant', 'system'].includes(m.role)) {
          return res.status(400).json({ error: `Invalid message role: ${m.role}` });
        }
        const contentStr = getTextContent(m.content);
        if (contentStr.length > MAX_CONTENT_LENGTH) {
          return res.status(400).json({ error: `A single message exceeds the ${MAX_CONTENT_LENGTH} character limit.` });
        }
        totalSize += contentStr.length;
        if (totalSize > MAX_TOTAL_MESSAGES_BYTES) {
          return res.status(400).json({ error: 'Conversation is too long to send in a single request.' });
        }
      }
      if (typeof req.body?.max_tokens === 'number' && (req.body.max_tokens < 1 || req.body.max_tokens > 32768)) {
        return res.status(400).json({ error: 'max_tokens must be between 1 and 32768.' });
      }
      if (typeof req.body?.temperature === 'number' && (req.body.temperature < 0 || req.body.temperature > 2)) {
        return res.status(400).json({ error: 'temperature must be between 0 and 2.' });
      }

      const hasVision = hasAnyVisionContent(messages);
      const isCompoundRequest = req.body?.compound === true || req.body?.model === 'groq/compound' || req.body?.model === 'groq/compound-mini';
      const requestedProvider = req.body?.provider;
      if (requestedProvider && !['groq', 'inception', 'cloudflare'].includes(requestedProvider)) {
        return res.status(400).json({ error: `Invalid provider: ${requestedProvider}` });
      }

      // Tiered Provider Cascade Assembly
      const providersToTry = [];

      if (hasVision) {
        // Vision requests MUST route to Groq Vision (Qwen / Llama 3.2 Vision)
        if (groqKey) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: true });
        }
        // If Inception is configured, add it as secondary fallback using conversation context
        if (inceptionKey) {
          providersToTry.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
        }
      } else if (isCompoundRequest) {
        // Compound / autonomous search & code execution routes to Groq
        if (groqKey) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: false });
        }
      } else {
        // Standard text requests: Inception primary, Groq automatic fallback
        if (requestedProvider === 'inception' && inceptionKey) {
          providersToTry.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
        } else if (requestedProvider === 'groq' && groqKey) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: false });
        }

        // Automatic default hierarchy: Inception -> Groq -> Cloudflare
        if (inceptionKey && !providersToTry.some(p => p.provider === 'inception')) {
          providersToTry.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
        }
        if (groqKey && !providersToTry.some(p => p.provider === 'groq')) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: false });
        }
        if (cfKey && cfAccount && !providersToTry.some(p => p.provider === 'cloudflare')) {
          providersToTry.push({ provider: 'cloudflare', apiKey: cfKey, isVision: false });
        }
      }

      if (providersToTry.length === 0) {
        return res.status(500).json({ 
          error: 'Configuration Error: Missing GROQ_API_KEY or INCEPTION_API in Vercel environment variables.' 
        });
      }

      let activeResponse = null;
      let lastError = null;
      let usedProvider = '';
      let usedModel = '';

      for (const p of providersToTry) {
        try {
          console.log(`[D-Ai API] Attempting provider: ${p.provider} (vision: ${!!p.isVision})...`);
          const result = await callProviderAPI({
            provider: p.provider,
            apiKey: p.apiKey,
            incomingBody: req.body || {},
            isVision: p.isVision
          });

          if (result.response && result.response.ok) {
            activeResponse = result.response;
            usedProvider = result.provider;
            usedModel = result.model;
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

      // Stream SSE chunks to client with reasoning normalization
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Provider': usedProvider,
        'X-Model': usedModel
      });

      const reader = activeResponse.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop(); // Keep incomplete trailing line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const rawData = line.slice(6).trim();
              if (rawData === '[DONE]') {
                res.write('data: [DONE]\n\n');
                continue;
              }

              try {
                const parsed = JSON.parse(rawData);
                const choice = parsed.choices?.[0];
                const delta = choice?.delta;

                // Normalize reasoning tokens (Groq DeepSeek-R1 / Qwen reasoning format)
                if (delta && delta.reasoning && !delta.content) {
                  // Forward reasoning delta so client receives clean reasoning chunks
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } else if (delta && delta.reasoning_content && !delta.content) {
                  delta.reasoning = delta.reasoning_content;
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } else {
                  res.write(`${line}\n\n`);
                }
              } catch (_) {
                res.write(`${line}\n\n`);
              }
            } else if (line.trim()) {
              res.write(`${line}\n\n`);
            }
          }
        }

        // Flush remaining buffer if any
        if (sseBuffer.trim()) {
          res.write(`${sseBuffer}\n\n`);
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
