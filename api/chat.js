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
6. If the user explicitly asks to generate media or interactive widgets, use clean fenced directives:
   - Image: <<GENERATE_IMAGE: prompt | 16:9 | 1024x1024>>
   - Video: <<GENERATE_VIDEO: prompt | 16:9 | 4>>
   - Music: <<GENERATE_MUSIC: prompt | 15>>
   - Interactive UI: \`\`\`dai-ui chart\`\`\` or \`\`\`dai-ui demo\`\`\` or \`\`\`dai-ui pythagoras\`\`\`
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
  let modelName = '';

  if (provider === 'inception') {
    endpoint = process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1/chat/completions';
    modelName = incomingBody.model && incomingBody.model.includes('mercury') ? incomingBody.model : 'mercury';
  } else {
    endpoint = 'https://api.cerebras.ai/v1/chat/completions';
    // Cerebras models: llama-3.3-70b, llama3.1-8b
    const requested = typeof incomingBody.model === 'string' ? incomingBody.model.trim() : '';
    if (requested && (requested.includes('llama') || requested.includes('cerebras'))) {
      modelName = requested;
    } else {
      modelName = 'llama-3.3-70b';
    }
  }

  const payload = {
    model: modelName,
    messages: [
      { role: 'system', content: fullSystemPrompt },
      ...otherMessages.map(normalizeMessageForProvider)
    ],
    stream: incomingBody.stream !== false,
    max_completion_tokens: incomingBody.max_completion_tokens || incomingBody.max_tokens || 8192,
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

  return { response, provider, model: modelName };
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
      primary_provider: inceptionKey ? 'Inception (Mercury)' : (cerebrasKey ? 'Cerebras (Llama 3.3 70B)' : 'None')
    });
  }

  if (req.method === 'POST') {
    try {
      if (!inceptionKey && !cerebrasKey) {
        return res.status(500).json({ error: 'Missing API keys. Configure INCEPTION_API or CEREBRAS_API_KEY.' });
      }

      // Build provider sequence (Primary + Automatic Fallback)
      const providersToTry = [];
      if (inceptionKey) {
        providersToTry.push({ provider: 'inception', apiKey: inceptionKey });
      }
      if (cerebrasKey) {
        providersToTry.push({ provider: 'cerebras', apiKey: cerebrasKey });
      }

      let activeResponse = null;
      let lastError = null;

      for (const p of providersToTry) {
        try {
          console.log(`[API Call] Trying provider: ${p.provider}...`);
          const result = await callProviderAPI({
            provider: p.provider,
            apiKey: p.apiKey,
            incomingBody: req.body || {}
          });

          if (result.response.ok) {
            activeResponse = result.response;
            console.log(`[API Call] Provider ${p.provider} responded successfully (200 OK) using ${result.model}`);
            break;
          } else {
            const errBody = await result.response.text();
            lastError = `Provider ${p.provider} (${result.response.status}): ${errBody}`;
            console.warn(`[API Call] ${p.provider} failed: ${lastError}. Attempting fallback...`);
          }
        } catch (callErr) {
          lastError = `Provider ${p.provider} exception: ${callErr.message}`;
          console.warn(`[API Call] Exception with ${p.provider}:`, callErr);
        }
      }

      if (!activeResponse) {
        console.error('[API All Providers Failed]:', lastError);
        return res.status(502).json({ error: lastError || 'All AI model providers failed to respond.' });
      }

      // Stream response to client
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
        console.error('Stream Transfer Error:', streamError);
      } finally {
        res.end();
      }

    } catch (e) {
      console.error('[Handler Critical Error]', e);
      return res.status(500).json({ error: e.message });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
