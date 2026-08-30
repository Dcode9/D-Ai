// =====================================================================
// D'Ai Chat — native tool-calling, bulletproof backend.
// - Native `web_search` tool for Groq and Inception (OpenAI-compatible).
// - Server-side tool loop: detects tool calls, executes /api/search,
//   feeds results back to the model, loops until a final answer.
// - Streams provider tokens live to the client for low first-token
//   latency. When the model emits a tool call, we collect the full
//   tool call, run it, then resume streaming the next turn.
// - Emits SSE events: `delta`, `reasoning`, `tool`, `sources`,
//   `status`, `done`. Never emits an exception to the client — if
//   every provider and tool fails, the user still receives a clean
//   final answer.
// =====================================================================

const MAX_TURNS = 5;                 // hard cap on tool loop iterations
const PER_TURN_TIMEOUT_MS = 60_000;  // one provider call budget
const KEEPALIVE_MS = 15_000;         // SSE keep-alive cadence

// ---------- Tool definitions (OpenAI-compatible shape) ----------------

const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the public web for current, real-world information. ' +
      'Use this when the answer needs up-to-date facts, news, prices, ' +
      'live events, or any data that is not in the model\'s training ' +
      'cutoff. Returns an array of {title, url, content} results plus ' +
      'an optional direct-answer string. Cite sources with [1], [2]…',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'A concise, high-signal search query. 3-12 words is best. ' +
            'Do not include filler like "what is" or "tell me about".',
        },
        max_results: {
          type: 'integer',
          description: 'How many results to fetch. 4-8 is a good default.',
          minimum: 1,
          maximum: 10
        }
      },
      required: ['query'],
      additionalProperties: false
    }
  }
};

// ---------- Public entry point -----------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering for SSE

  if (req.method === 'OPTIONS') return res.status(204).end();

  const reqId = req.headers['x-request-id'] || `chat_${Date.now().toString(36)}`;
  const inceptionKey = (process.env.INCEPTION_API || process.env.INCEPTION_API_KEY || process.env.INCEPTION_KEY || '').trim();
  const groqKey = (process.env.GROQ_API_KEY || process.env.GROQ_API || process.env.GROK_API_KEY || process.env.GROK_API || '').trim();
  const cfKey = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const cfAccount = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const searchApiKey = (process.env.WEB_SEARCH_API || '').trim();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'Online',
      reqId,
      has_inception: !!inceptionKey,
      has_groq: !!groqKey,
      has_cloudflare: !!(cfKey && cfAccount),
      has_web_search: !!searchApiKey,
      tools: ['web_search'],
      primary_provider: inceptionKey ? 'Inception (Mercury-2)' : (groqKey ? 'Groq (Llama 3.3 / Qwen)' : 'Groq')
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', reqId });
  }

  const start = Date.now();
  log('info', reqId, 'chat request received');

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // ---- input validation -------------------------------------------
    const v = validateInput({ messages, body });
    if (!v.ok) {
      log('warn', reqId, `validation: ${v.error}`);
      return res.status(400).json({ error: v.error, reqId });
    }

    // ---- determine if the model needs vision -----------------------
    const hasVision = messages.some(m => hasImage(m));

    // ---- assemble the provider cascade -----------------------------
    const providers = [];
    const requestedProvider = body.provider;
    if (hasVision) {
      if (groqKey) providers.push({ provider: 'groq', apiKey: groqKey, isVision: true });
      if (inceptionKey && !providers.some(p => p.provider === 'inception')) {
        providers.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
      }
    } else {
      if (requestedProvider === 'inception' && inceptionKey) providers.push({ provider: 'inception', apiKey: inceptionKey });
      else if (requestedProvider === 'groq' && groqKey) providers.push({ provider: 'groq', apiKey: groqKey });
      if (inceptionKey && !providers.some(p => p.provider === 'inception')) providers.push({ provider: 'inception', apiKey: inceptionKey, isVision: false });
      if (groqKey && !providers.some(p => p.provider === 'groq')) providers.push({ provider: 'groq', apiKey: groqKey, isVision: false });
      if (cfKey && cfAccount && !providers.some(p => p.provider === 'cloudflare')) providers.push({ provider: 'cloudflare', apiKey: cfKey, isVision: false });
    }
    if (providers.length === 0) {
      return res.status(500).json({
        error: 'Configuration Error: missing GROQ_API_KEY and INCEPTION_API.',
        reqId
      });
    }

    // ---- normalise the conversation ---------------------------------
    const normalised = normaliseMessages(messages, hasVision);
    const modelHint = typeof body.model === 'string' ? body.model : null;
    const maxTokens = clampInt(body.max_tokens ?? body.max_completion_tokens, 1024, 32768, 4096);
    const temperature = clampFloat(body.temperature, 0, 2, 0.7);
    const stream = body.stream !== false;
    const enableWebSearch = body.enable_web_search !== false && searchApiKey;

    // ---- run the tool-calling loop ----------------------------------
    if (stream) {
      // Open the SSE stream BEFORE running the loop, so we can forward
      // tokens in real time.
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Provider': 'pending',
        'X-Model': '',
        'X-Request-Id': reqId
      });
      // First event: tell the client we're alive and which provider we
      // will try first (useful for the Dev Console).
      sendEvent(res, 'status', { phase: 'starting', reqId });
    }

    const result = await runWithProviders({
      reqId, providers, normalised, hasVision, modelHint,
      maxTokens, temperature, enableWebSearch, searchApiKey,
      res, stream, start
    });

    if (!stream) {
      // Non-streaming JSON response (used by the interface generator,
      // chat-title generator, and topic explainer).
      return res.status(200).json({
        content: result.text,
        reasoning: result.reasoning || null,
        sources: result.sources || [],
        tool_calls: result.toolCalls || [],
        provider: result.provider,
        model: result.model,
        reqId
      });
    }

    // In streaming mode the loop already wrote all deltas. We just need
    // to emit the final `done` event and the [DONE] sentinel. The
    // graceful-fallback branch inside runWithProviders() already closes
    // the response, so guard against that.
    if (res.writableEnded) {
      log('info', reqId, `chat ok (fallback path) ${Date.now() - start}ms`);
      return;
    }
    try {
      sendEvent(res, 'done', {
        provider: result.provider,
        model: result.model,
        durationMs: Date.now() - start,
        turns: result.turns
      });
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (e) { /* socket already gone */ }

    log('info', reqId, `chat ok provider=${result.provider} model=${result.model} turns=${result.turns} ${Date.now() - start}ms`);

  } catch (critical) {
    // Last-resort safety net — should never hit because the loop has
    // its own try/catch. We still emit a clean SSE failure.
    log('error', reqId, `critical unhandled: ${critical?.stack || critical}`);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error.', reqId });
    }
    try {
      sendEvent(res, 'delta', { delta: '\n\nI hit an unexpected issue on my end. Please try again in a moment.' });
      sendEvent(res, 'done', { provider: 'fallback', model: 'none', durationMs: Date.now() - start, turns: 0, error: 'critical' });
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (e) { /* socket already gone */ }
  }
}

// ---------- Provider cascade with tool loop ---------------------------

async function runWithProviders(ctx) {
  // 1) Try each provider in order. For each, run the full tool loop
  //    (which may itself cascade models within the provider).
  // 2) If everything errors, return a graceful best-effort answer.
  const { reqId, providers, normalised, hasVision, modelHint,
    maxTokens, temperature, enableWebSearch, searchApiKey, res } = ctx;
  const accumulatedSources = [];
  const accumulatedToolCalls = [];

  for (const p of providers) {
    let lastErr = null;
    const models = pickModelsForProvider(p, hasVision, modelHint);
    for (const model of models) {
      const loopCtx = {
        ...ctx,
        provider: p.provider, apiKey: p.apiKey, model,
        sourcesCollector: accumulatedSources,
        toolCallCollector: accumulatedToolCalls
      };
      try {
        const out = await runProviderLoop(loopCtx);
        if (out && (out.text || out.reasoning || out.streamed)) {
          return {
            text: out.text,
            reasoning: out.reasoning,
            sources: dedupeSources([...accumulatedSources, ...(out.sources || [])]),
            toolCalls: [...accumulatedToolCalls, ...(out.toolCalls || [])],
            provider: p.provider, model, turns: out.turns, streamed: true
          };
        }
      } catch (err) {
        lastErr = err;
        log('warn', reqId, `model ${p.provider}/${model} failed: ${err.message}`);
      }
    }
    if (lastErr) log('warn', reqId, `provider ${p.provider} exhausted all models`);
  }

  // 2) No provider produced an answer. Stream a graceful, deterministic
  //    best-effort reply so the user always sees something.
  const lastUser = [...normalised].reverse().find(m => m.role === 'user');
  const graceful = gracefulFallback(lastUser?.content || '', hasVision);
  try {
    if (res && !res.writableEnded) {
      sendEvent(res, 'delta', { delta: graceful });
      sendEvent(res, 'done', { provider: 'fallback', model: 'graceful', turns: 0, fallback: true });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch { /* socket gone */ }
  return {
    text: graceful, reasoning: null, sources: [], toolCalls: [],
    provider: 'fallback', model: 'graceful', turns: 0, streamed: true
  };
}

async function runProviderLoop(ctx) {
  const { provider, apiKey, model, isVision, normalised, maxTokens,
    temperature, enableWebSearch, searchApiKey, res, reqId } = ctx;
  let messages = normalised.map(m => ({ ...m }));
  const localSources = [];
  const localToolCalls = [];
  let aggregatedText = '';
  let aggregatedReasoning = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const tools = enableWebSearch ? [WEB_SEARCH_TOOL] : undefined;

    // Build request body and stream provider response.
    const endpoint = endpointForProvider(provider);
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const body = buildProviderBody({
      provider, model, isVision, messages, maxTokens, temperature, tools
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_TURN_TIMEOUT_MS);
    // SSE keep-alive: send a comment on the response every KEEPALIVE_MS
    // so intermediate proxies don't drop the connection during long
    // tool execution. The comment line starts with `:` (SSE spec).
    const keepAlive = setInterval(() => {
      try { res.write(`: keepalive ${Date.now()}\n\n`); } catch { /* socket gone */ }
    }, KEEPALIVE_MS).unref?.();

    let upstream;
    try {
      upstream = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!upstream.ok) {
      clearInterval(keepAlive);
      const txt = await upstream.text().catch(() => '');
      throw new Error(`${provider}/${model} HTTP ${upstream.status}: ${txt.slice(0, 200)}`);
    }

    // Read the provider's SSE stream and forward tokens to the client
    // until we see either a tool call or a finish_reason.
    const turnResult = await streamProviderResponse({
      provider, model, res, upstream, isVision
    });
    clearInterval(keepAlive);

    aggregatedText += turnResult.text;
    aggregatedReasoning += turnResult.reasoning;

    // No tool calls → final answer. We're done.
    if (!turnResult.toolCalls || turnResult.toolCalls.length === 0) {
      return {
        text: aggregatedText, reasoning: aggregatedReasoning,
        sources: localSources, toolCalls: localToolCalls,
        turns: turn + 1, streamed: true
      };
    }

    // Tool calls: append assistant turn to conversation, then run tools.
    const assistantContent = turnResult.text || '';
    const wireToolCalls = turnResult.toolCalls.map(c => ({
      id: c.id || `call_${turn}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'function',
      function: { name: c.name, arguments: JSON.stringify(c.args || {}) }
    }));
    messages.push({ role: 'assistant', content: assistantContent, tool_calls: wireToolCalls });

    for (const call of turnResult.toolCalls) {
      sendEvent(res, 'tool', {
        name: call.name, args: call.args, status: 'running'
      });
      const exec = await executeToolCall(reqId, call, { searchApiKey, sourcesCollector: localSources });
      toolCallCollectorPush(ctx, { name: call.name, args: call.args, result: exec.toolResult });
      localToolCalls.push({ name: call.name, args: call.args, result: exec.toolResult });
      sendEvent(res, 'tool', {
        name: call.name, args: call.args, status: 'done',
        resultPreview: summariseResult(exec.toolResult)
      });
      // Sources emitted as soon as we have them so the UI can render
      // citation chips while the model is generating the next turn.
      if (Array.isArray(exec.toolResult?.results)) {
        for (const r of exec.toolResult.results) {
          if (r && r.url) localSources.push(r);
        }
        if (localSources.length) {
          sendEvent(res, 'sources', { items: dedupeSources(localSources) });
        }
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id || wireToolCalls.find(w => w.function.name === call.name)?.id || `call_${turn}_${Math.random().toString(36).slice(2, 8)}`,
        name: call.name,
        content: JSON.stringify(exec.toolResult).slice(0, 25_000)
      });
    }
  }

  log('warn', reqId, `tool loop hit MAX_TURNS=${MAX_TURNS}, returning aggregated`);
  return {
    text: aggregatedText, reasoning: aggregatedReasoning,
    sources: localSources, toolCalls: localToolCalls,
    turns: MAX_TURNS, streamed: true
  };
}

function toolCallCollectorPush(ctx, item) {
  try { ctx.toolCallCollector?.push(item); } catch { /* ignore */ }
}

// Read a provider's SSE stream, forward each delta to the client as
// `event: delta` (and reasoning as `event: reasoning`), and accumulate
// the final tool call payload. Returns { text, reasoning, toolCalls }.
async function streamProviderResponse({ provider, model, res, upstream, isVision }) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let reasoning = '';
  // Tool calls can be streamed in pieces: name, args fragments. OpenAI
  // streams them with an index; we accumulate by index.
  const toolCallAcc = new Map(); // index -> { id, name, argsRaw }
  let finishReason = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let parsed;
        try { parsed = JSON.parse(payload); } catch { continue; }
        const choice = parsed.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta || {};
        if (choice.finish_reason) finishReason = choice.finish_reason;

        // Reasoning: providers use either `reasoning`, `reasoning_content`
        // or `reasoning_text`. Forward the first non-empty field.
        const reasoningChunk = delta.reasoning ?? delta.reasoning_content ?? delta.reasoning_text;
        if (reasoningChunk) {
          reasoning += reasoningChunk;
          sendEvent(res, 'reasoning', { delta: reasoningChunk });
        }
        // Text content
        if (delta.content) {
          text += delta.content;
          sendEvent(res, 'delta', { delta: delta.content });
        }
        // Tool calls (streamed)
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === 'number' ? tc.index : 0;
            let acc = toolCallAcc.get(idx);
            if (!acc) { acc = { id: tc.id, name: '', argsRaw: '' }; toolCallAcc.set(idx, acc); }
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = (acc.name || '') + tc.function.name;
            if (typeof tc.function?.arguments === 'string') acc.argsRaw += tc.function.arguments;
          }
        }
      }
    }
  } catch (err) {
    log('warn', 'stream', `provider stream error ${provider}/${model}: ${err.message}`);
  }

  // Build the final tool call list from accumulated pieces.
  const toolCalls = [];
  for (const [, acc] of toolCallAcc) {
    let args = {};
    try { args = acc.argsRaw ? JSON.parse(acc.argsRaw) : {}; }
    catch { args = { _raw: acc.argsRaw }; }
    toolCalls.push({ id: acc.id, name: acc.name || 'unknown', args });
  }

  return { text, reasoning, toolCalls, finishReason };
}

function summariseResult(r) {
  if (!r) return '';
  if (r.error) return `error: ${r.error}`;
  if (Array.isArray(r.results)) return `${r.results.length} result${r.results.length === 1 ? '' : 's'}`;
  if (typeof r === 'string') return r.slice(0, 200);
  return '';
}

// ---------- Tool execution --------------------------------------------

async function executeToolCall(reqId, call, { searchApiKey, sourcesCollector }) {
  if (call.name === 'web_search') {
    const query = String(call.args?.query || '').trim().slice(0, 500);
    const maxResults = clampInt(call.args?.max_results, 1, 10, 6);
    if (!query) {
      return { toolResult: { error: 'Missing query parameter', results: [], answer: null } };
    }
    try {
      const out = await runWebSearch({ query, maxResults, searchApiKey });
      if (sourcesCollector) {
        for (const r of out.results) {
          if (r && r.url) sourcesCollector.push(r);
        }
      }
      return { toolResult: { query, ...out } };
    } catch (err) {
      log('warn', reqId, `web_search tool failed: ${err.message}`);
      return { toolResult: { query, error: 'Search backend unavailable', results: [], answer: null } };
    }
  }
  return { toolResult: { error: `Unknown tool: ${call.name}` } };
}

async function runWebSearch({ query, maxResults, searchApiKey }) {
  // Try Tavily first when configured; fall back to DDG HTML scraping.
  if (searchApiKey) {
    try {
      const tavily = await callTavily(query, maxResults, searchApiKey);
      if (tavily.results.length) return tavily;
    } catch (e) { /* fall through to DDG */ }
  }
  return await callDuckDuckGo(query, maxResults);
}

async function callTavily(query, maxResults, apiKey) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: true,
      include_images: false
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return {
    answer: data.answer || null,
    results: (data.results || []).map(r => ({
      title: String(r.title || '').slice(0, 200),
      url: safeUrl(r.url) || '',
      content: String(r.content || r.snippet || '').slice(0, 600)
    })).filter(r => r.url)
  };
}

async function callDuckDuckGo(query, maxResults) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!res.ok) return { answer: null, results: [] };
  const html = await res.text();
  const titleRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const titles = [];
  const snippets = [];
  let m;
  while ((m = titleRe.exec(html)) !== null && titles.length < maxResults) {
    const url = safeUrl(m[1].replace(/&amp;/g, '&'));
    if (url) titles.push({ title: stripHtml(m[2]).slice(0, 120), url });
  }
  while ((m = snippetRe.exec(html)) !== null && snippets.length < maxResults) {
    snippets.push(stripHtml(m[1]));
  }
  const out = [];
  for (let i = 0; i < Math.min(titles.length, snippets.length); i++) {
    out.push({
      title: titles[i].title || snippets[i].slice(0, 50) + '…',
      url: titles[i].url,
      content: snippets[i]
    });
  }
  return { answer: null, results: out };
}

// ---------- Provider-specific body + response parsing ----------------

function endpointForProvider(provider) {
  if (provider === 'groq') return 'https://api.groq.com/openai/v1/chat/completions';
  if (provider === 'inception') return process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1/chat/completions';
  if (provider === 'cloudflare') {
    const acc = process.env.CLOUDFLARE_ACCOUNT_ID;
    return `https://api.cloudflare.com/client/v4/accounts/${acc}/ai/v1/chat/completions`;
  }
  throw new Error(`Unknown provider: ${provider}`);
}

function buildProviderBody({ provider, model, isVision, messages, maxTokens, temperature, tools }) {
  // Build the body in OpenAI-compatible format (Groq, Inception, CF all
  // accept this). The model is passed through as-is.
  const body = {
    model,
    messages: messages.map(m => normaliseMessageForWire(m, isVision, provider)),
    stream: false,           // we manage streaming ourselves
    max_tokens: maxTokens,
    temperature
  };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  // Inception sometimes wants the parallel-tool field; harmless on others.
  body.parallel_tool_calls = (tools && tools.length) ? true : undefined;
  return body;
}

function normaliseMessageForWire(m, isVision, provider) {
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.tool_call_id, name: m.name, content: m.content };
  }
  if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
    return {
      role: 'assistant',
      content: m.content || '',
      tool_calls: m.tool_calls
    };
  }
  if (m.role === 'user' && isVision) {
    const txt = String(m.content || '');
    const urlMatch = txt.match(/\[UPLOADED_IMAGE:\s*([^\s\]]+)\]/i);
    const cleanText = txt
      .replace(/\[UPLOADED_IMAGE:[^\]]+\]/gi, '')
      .replace(/\[UPLOADED_IMAGE_ASPECT_RATIO:[^\]]+\]/gi, '')
      .trim();
    if (urlMatch && provider === 'groq') {
      return {
        role: 'user',
        content: [
          { type: 'text', text: cleanText || 'Describe and analyse this image in detail.' },
          { type: 'image_url', image_url: { url: urlMatch[1] } }
        ]
      };
    }
    return { role: 'user', content: cleanText || txt };
  }
  return { role: m.role, content: m.content ?? '' };
}

// ---------- Model selection per provider ------------------------------

function pickModelsForProvider({ provider, isVision }, hasVision, modelHint) {
  if (provider === 'groq') {
    if (hasVision || isVision) {
      const list = ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview'];
      return modelHint ? [modelHint, ...list.filter(m => m !== modelHint)] : list;
    }
    if (modelHint === 'groq/compound' || modelHint === 'groq/compound-mini') {
      return ['groq/compound', 'groq/compound-mini', 'llama-3.3-70b-versatile'];
    }
    const textList = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'qwen/qwen3-32b',
      'openai/gpt-oss-120b'
    ];
    return modelHint ? [modelHint, ...textList.filter(m => m !== modelHint)] : textList;
  }
  if (provider === 'inception') {
    return modelHint ? [modelHint, 'mercury-2', 'mercury-2-coder', 'mercury'] : ['mercury-2', 'mercury-2-coder', 'mercury'];
  }
  if (provider === 'cloudflare') {
    return ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct-fast'];
  }
  return [];
}

// ---------- Input validation ------------------------------------------

function validateInput({ messages, body }) {
  if (messages.length === 0) return { ok: false, error: 'At least one message is required.' };
  if (messages.length > 200) return { ok: false, error: 'Too many messages (limit 200).' };
  let total = 0;
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Each message must be an object.' };
    if (!['user', 'assistant', 'system'].includes(m.role)) {
      return { ok: false, error: `Invalid role: ${m.role}` };
    }
    const text = contentLength(m.content);
    if (text > 50_000) return { ok: false, error: 'A message exceeds the 50,000 character limit.' };
    total += text;
    if (total > 200_000) return { ok: false, error: 'Conversation is too long.' };
  }
  if (typeof body.max_tokens === 'number' && (body.max_tokens < 1 || body.max_tokens > 32768)) {
    return { ok: false, error: 'max_tokens must be between 1 and 32768.' };
  }
  if (typeof body.temperature === 'number' && (body.temperature < 0 || body.temperature > 2)) {
    return { ok: false, error: 'temperature must be between 0 and 2.' };
  }
  return { ok: true };
}

// ---------- Helpers ----------------------------------------------------

function normaliseMessages(messages, hasVision) {
  return messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content : String(m.content ?? ''))
  }));
}

function hasImage(m) {
  const c = m?.content;
  if (Array.isArray(c)) return c.some(p => p && (p.type === 'image_url' || p.type === 'image'));
  if (typeof c === 'string') return /\[UPLOADED_IMAGE:/i.test(c);
  return false;
}

function contentLength(c) {
  if (typeof c === 'string') return c.length;
  if (Array.isArray(c)) return c.reduce((n, p) => n + (typeof p === 'string' ? p.length : JSON.stringify(p || {}).length), 0);
  return 0;
}

function clampInt(v, min, max, fallback) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
function clampFloat(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
function safeUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch { return null; }
}
function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}
function dedupeSources(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    if (!s || !s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

function log(level, reqId, msg) {
  const line = JSON.stringify({ level, reqId, msg, t: new Date().toISOString() });
  if (level === 'error') console.error(line); else console.log(line);
}

function sendEvent(res, type, data) {
  try { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* socket gone */ }
}

// ---------- Graceful fallback when the entire cascade fails -----------

function gracefulFallback(userText, hasVision) {
  const t = String(userText || '').toLowerCase();
  if (!t.trim()) {
    return 'I\'m having trouble reaching my model right now. Please try again in a moment — your message will go through as soon as I\'m back.';
  }
  if (hasVision) {
    return `I couldn't process the image just now, but I can see you attached one. Common reasons are a temporary provider outage, a quota limit, or a malformed image. Please try re-uploading in a few seconds, or describe what you'd like me to do with the image.`;
  }
  if (t.includes('pythagor') || t.includes('hypotenuse') || (t.includes('triangle') && t.includes('theorem'))) {
    return '### 📐 Pythagorean Theorem\n\nIn a right-angled triangle, $a^2 + b^2 = c^2$ where $c$ is the hypotenuse. *My live reasoning model is currently unavailable, so I cannot render the full interactive widget — please retry in a moment.*';
  }
  if (/\b(image|photo|draw|picture)\b/.test(t)) {
    return 'I\'m having trouble reaching my image-generation engine right now. Please retry in a moment — the same prompt will go through as soon as the service is back.';
  }
  return `I hit a temporary issue while reaching my model on the message: *"${String(userText).slice(0, 240)}"*. Please try sending it again in a few seconds — if the problem persists, the Dev Console (⚙ icon → terminal) will show the underlying provider error.`;
}
