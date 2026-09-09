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

const NATIVE_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information, current news, factual verification, websites, documentation, and live data. Formulate specific, high-signal keyword queries.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The specific search keywords or query to find information on the web."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate a rich visual artwork, image, painting, or render based on a descriptive prompt.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image to generate, including subjects, style, lighting, composition, and mood."
          },
          aspect_ratio: {
            type: "string",
            enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
            description: "Aspect ratio of the generated image. Defaults to 1:1."
          }
        },
        required: ["prompt"]
      }
    }
  }
];

function normalizeMessageForProvider(message, isVision = false) {
  if (!message || typeof message !== 'object') return { role: 'user', content: '' };
  const role = message.role || 'user';

  if (role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.tool_call_id || message.id || 'call_0',
      content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    };
  }

  if (role === 'assistant') {
    const res = { role: 'assistant', content: message.content || '' };
    if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      res.tool_calls = message.tool_calls;
    }
    return res;
  }
  
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
  return { role: 'user', content: cleanText };
}

function buildSystemPrompt(messages, isVision = false) {
  if (isVision) {
    return `You are D'Ai, a multimodal AI vision assistant created by Dhairya Shah.
Analyze any provided images with high precision, identifying all visible objects, text, equations, code, diagrams, charts, colors, people, and details.
Answer the user's questions about the image truthfully and directly based strictly on the actual visual content.`;
  }

  const systemMessages = messages.filter(m => m && m.role === 'system');
  const baseSystemPrompt = `You are D'Ai, an ornate, profound, and exceptionally rigorous intelligence created by Dhairya Shah.

CORE GUIDELINES:
1. STRICT FACTUAL ACCURACY & ZERO HALLUCINATIONS:
   - When answering questions about current events, live news, real-world facts, benchmarks, technical releases, or products, your response must be 100% truthful and grounded in verified data.
   - When web search results are provided via tool calls, synthesize your response SOLELY from the retrieved sources. NEVER fabricate, extrapolate, or invent model names, synthetic version numbers, or unverified benchmark scores.
   - Always cite your sources with clear, clickable Markdown links like [Source Title](url) or [Reuters](url) directly next to the factual claims.

2. NATIVE TOOLS:
   - \`web_search\`: Call this tool whenever you need up-to-date facts, current real-world data, recent news, or verification. Formulate concise, high-signal search queries (e.g. "latest AI news September 2026", "DeepSeek V3 benchmark results").
   - \`generate_image\`: Call this tool when the user explicitly asks to generate, create, draw, or paint an image.

3. VOICE & REGAL PRESENTATION:
   - Eloquent, regal, articulate, and profoundly helpful.
   - Format with elegant Markdown: structured headers, concise bullet points, comparison tables, bold key concepts, and active source links.`;

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
    candidateModels = incomingBody.model ? [incomingBody.model, 'mercury-2.5', 'mercury-2', 'mercury-2-coder', 'mercury'] : ['mercury-2.5', 'mercury-2', 'mercury-2-coder', 'mercury'];
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

      if (provider === 'inception') {
        payload.reasoning_effort = incomingBody.reasoning_effort || 'medium';
        payload.reasoning_summary = true;
      }

      // Pass-through tools and function calling parameters
      if (Array.isArray(incomingBody.tools) && incomingBody.tools.length > 0) {
        payload.tools = incomingBody.tools;
        if (incomingBody.tool_choice) payload.tool_choice = incomingBody.tool_choice;
      } else if (incomingBody.enable_tools !== false && !isVision) {
        payload.tools = NATIVE_TOOLS;
        payload.tool_choice = incomingBody.tool_choice || 'auto';
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
      const hasVision = hasAnyVisionContent(messages);
      const isCompoundRequest = req.body?.compound === true || req.body?.model === 'groq/compound' || req.body?.model === 'groq/compound-mini';
      const requestedProvider = req.body?.provider;

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

                // Handle Inception reasoning_summary in chunk
                if (parsed.reasoning_summary && parsed.reasoning_summary.content) {
                  if (!choice.delta) choice.delta = {};
                  choice.delta.reasoning = parsed.reasoning_summary.content;
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } else if (delta && delta.reasoning && !delta.content) {
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
