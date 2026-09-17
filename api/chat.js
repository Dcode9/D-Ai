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
  },
  {
    type: "function",
    function: {
      name: "manage_memory",
      description: "Manage persistent intellectual continuity with the user. Store key preferences, ongoing projects, active focus, or close resolved topics so D'Ai acts as an intelligent partner.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add", "update", "close", "remove", "recall"],
            description: "Action: 'add' to record a new insight/focus, 'update' to update an existing topic, 'close' to mark an active topic resolved/distilled, 'remove' to delete, 'recall' to inspect."
          },
          topic: {
            type: "string",
            description: "Concise domain or subject (e.g., 'React Architecture', 'Quantum Mechanics', 'User Identity', 'Active Focus')."
          },
          summary: {
            type: "string",
            description: "Distilled essence or persistent principle to remember."
          },
          detail: {
            type: "string",
            description: "Rich contextual details for active/ongoing work (kept detailed until closed)."
          },
          fact: {
            type: "string",
            description: "Concise statement or piece of knowledge about the user."
          }
        },
        required: ["action"]
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
   - Format with elegant Markdown: structured headers, concise bullet points, comparison tables, bold key concepts, and active source links.

4. IN-CHAT DIRECT OUTPUT & INTERACTIVE ARTIFACTS:
   - When the user asks to build, create, write, demonstrate, or design ANY web application, user interface, component, calculator, simulation, interactive tool, game, widget, or visualization, the user wants to SEE AND USE the live interactive result directly.
   - Always write complete, self-contained, fully functional HTML with inline <style> and <script>.
   - Adhere strictly to D'Ai's regal ornate design philosophy: dark velvet obsidian backgrounds (#1c1b1a, #232220), glowing gold borders (#c9a86a, #e8d3a0), cream typography, and predesigned component classes (.dai-card, .dai-btn, .dai-btn-secondary, .dai-badge, .dai-input, .dai-divider).
   - Wrap the entire application code inside a \`\`\`dai-artifact (or \`\`\`html) code block. D'Ai's interface will render it directly as an interactive live running preview in the chat!

5. ALWAYS PROVIDE LINKS FOR PREVIEWABLE WEBSITES:
   - Whenever you create, recommend, mention, or search for previewable websites, interactive tools, web demos, live prototypes, repositories, or online pages, you MUST ALWAYS provide clear, direct, clickable Markdown links (e.g. [Preview Website Name](url) or [Launch Live Demo](url)).
   - Never mention a website, tool, or demo without embedding its active clickable link.`;

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
  } else if (provider === 'gemini') {
    endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    candidateModels = ['gemini-3.6-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'cerebras') {
    endpoint = 'https://api.cerebras.ai/v1/chat/completions';
    candidateModels = ['gpt-oss-120b', 'qwen-3.8-27b'];
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'pollinations') {
    endpoint = 'https://text.pollinations.ai/openai/chat/completions';
    candidateModels = ['openai', 'mistral', 'claude-hybridspace'];
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
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  const cerebrasKey = (process.env.CEREBRAS_API_KEY || '').trim();
  const pollinationsKey = (process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API || '').trim();
  const cfKey = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const cfAccount = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();

  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      has_groq: !!groqKey,
      has_gemini: !!geminiKey,
      has_inception: !!inceptionKey,
      has_cerebras: !!cerebrasKey,
      has_pollinations: !!pollinationsKey,
      has_cloudflare: !!(cfKey && cfAccount),
      primary_provider: groqKey ? 'Groq (Llama 3.3 / Qwen)' : (geminiKey ? 'Gemini (3.6 Flash)' : (inceptionKey ? 'Inception' : 'D-Ai Engine'))
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
        // Vision requests: Groq Vision (Qwen) primary, Gemini 3.6 Flash multimodal secondary
        if (groqKey) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: true });
        }
        if (geminiKey) {
          providersToTry.push({ provider: 'gemini', apiKey: geminiKey, isVision: true });
        }
        if (inceptionKey) {
          providersToTry.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
        }
      } else if (isCompoundRequest) {
        // Compound / autonomous search & code execution routes to Groq or Gemini
        if (groqKey) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: false });
        }
        if (geminiKey) {
          providersToTry.push({ provider: 'gemini', apiKey: geminiKey, isVision: false });
        }
      } else {
        // User requested provider override
        if (requestedProvider === 'groq' && groqKey) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: false });
        } else if (requestedProvider === 'gemini' && geminiKey) {
          providersToTry.push({ provider: 'gemini', apiKey: geminiKey, isVision: false });
        } else if (requestedProvider === 'inception' && inceptionKey) {
          providersToTry.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
        }

        // Default resilient cascade: Groq -> Gemini -> Inception -> Cerebras -> Pollinations -> Cloudflare
        if (groqKey && !providersToTry.some(p => p.provider === 'groq')) {
          providersToTry.push({ provider: 'groq', apiKey: groqKey, isVision: false });
        }
        if (geminiKey && !providersToTry.some(p => p.provider === 'gemini')) {
          providersToTry.push({ provider: 'gemini', apiKey: geminiKey, isVision: false });
        }
        if (inceptionKey && !providersToTry.some(p => p.provider === 'inception')) {
          providersToTry.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
        }
        if (cerebrasKey && !providersToTry.some(p => p.provider === 'cerebras')) {
          providersToTry.push({ provider: 'cerebras', apiKey: cerebrasKey, isVision: false });
        }
        if (pollinationsKey && !providersToTry.some(p => p.provider === 'pollinations')) {
          providersToTry.push({ provider: 'pollinations', apiKey: pollinationsKey, isVision: false });
        }
        if (cfKey && cfAccount && !providersToTry.some(p => p.provider === 'cloudflare')) {
          providersToTry.push({ provider: 'cloudflare', apiKey: cfKey, isVision: false });
        }
      }

      if (providersToTry.length === 0) {
        return res.status(500).json({ 
          error: 'Configuration Error: Missing GROQ_API_KEY, GEMINI_API_KEY, or INCEPTION_API in environment variables.' 
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
