// Durable, server-side chat runs.
// The browser starts a run and can disappear; this function keeps generating
// and writes the growing answer into the ai_messages row. Every signed-in
// device sees it through Supabase Realtime (or a plain refetch).
import chatHandler from './chat.js';
import searchHandler from './search.js';

export const config = { maxDuration: 300 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gmwieijbrrztukqpfwkg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY || 'sb_publishable_KX3MYtV84QJJdy9bPDuMEA_V99sLKSE';
const MAX_LOOPS = 5;
const FLUSH_MS = 350;

async function sb(path, token, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  return res;
}

async function getUser(token) {
  const res = await sb('/auth/v1/user', token, { method: 'GET' });
  if (!res.ok) return null;
  const u = await res.json();
  return u && u.id ? u : null;
}

// Collects what the existing /api/chat handler streams (SSE) without a real socket.
export function createCapture(onEvent) {
  let buf = '';
  let ended = false;
  let status = 200;
  let errorBody = '';
  const headers = {};
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  const feed = (chunk) => {
    buf += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data: ')) continue;
      const raw = t.slice(6);
      if (raw === '[DONE]') continue;
      try { onEvent(JSON.parse(raw)); } catch { /* ignore partial json */ }
    }
  };
  const res = {
    setHeader(k, v) { headers[k] = v; return res; },
    writeHead(code) { status = code; return res; },
    status(code) { status = code; return res; },
    json(obj) { errorBody = JSON.stringify(obj); ended = true; resolveDone(); return res; },
    write(chunk) { feed(chunk); return true; },
    end(chunk) { if (chunk) feed(chunk); if (buf) feed('\n'); ended = true; resolveDone(); return res; },
    flushHeaders() {},
    on() { return res; },
    get statusCode() { return status; },
    get writableEnded() { return ended; },
  };
  return { res, done, get status() { return status; }, get errorBody() { return errorBody; } };
}

async function runSearch(query) {
  try {
    const r = await searchHandler(new Request('http://internal/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }));
    const data = await r.json();
    const items = Array.isArray(data.results) ? data.results.slice(0, 8) : [];
    return {
      sources: items.map((i) => ({ title: i.title || query, url: i.url, snippet: String(i.content || i.snippet || '').slice(0, 360) })),
      text: JSON.stringify({ answer: data.answer || null, results: items.map((i) => ({ title: i.title, url: i.url, content: String(i.content || i.snippet || '').slice(0, 900) })) }),
    };
  } catch (e) {
    return { sources: [], text: JSON.stringify({ error: 'search failed' }) };
  }
}

export async function runGeneration({ token, messageId, userId, body, patch = patchRow, emit = () => {} }) {
  const history = Array.isArray(body.messages) ? [...body.messages] : [];
  let content = '';
  let thinking = '';
  const sources = [];
  const toolLog = [];
  let lastFlush = 0;
  let status = 'streaming';
  const startedAt = Date.now();
  let firstAt = 0;

  const flush = async (force = false, extra = {}) => {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    lastFlush = now;
    let mid;
    try { mid = await messageId; } catch { return; }
    await patch(token, mid, userId, {
      content,
      metadata: { status, thinking: thinking || undefined, sources: sources.length ? sources : undefined, tools: toolLog.length ? toolLog : undefined, updated_at: new Date().toISOString(), ...extra },
    });
  };

  try {
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const calls = {};
      let turnText = '';
      const cap = createCapture((evt) => {
        const delta = evt?.choices?.[0]?.delta;
        if (!delta) return;
        const think = delta.reasoning || delta.reasoning_content || delta.reasoning_text;
        if (think) { thinking += think; emit({ type: 'thinking', delta: think }); }
        if ((delta.content || think) && !firstAt) { firstAt = Date.now(); emit({ type: 'timing', first_token_ms: firstAt - startedAt }); }
        if (delta.content) { turnText += delta.content; content += delta.content; emit({ type: 'content', delta: delta.content }); }
        for (const tc of delta.tool_calls || []) {
          const i = tc.index ?? 0;
          calls[i] = calls[i] || { id: tc.id || `call_${loop}_${i}`, name: '', arguments: '' };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function?.name && !calls[i].name) { calls[i].name = tc.function.name; emit({ type: 'tool_start', name: tc.function.name }); }
          else if (tc.function?.name) calls[i].name = tc.function.name;
          if (tc.function?.arguments) calls[i].arguments += tc.function.arguments;
        }
      });
      const fakeReq = { method: 'POST', body: { ...body, messages: history, stream: true }, headers: {} };
      const flusher = setInterval(() => { flush(false).catch(() => {}); }, FLUSH_MS);
      try {
        await chatHandler(fakeReq, cap.res);
        await Promise.race([cap.done, new Promise((r) => setTimeout(r, 1000))]);
      } finally { clearInterval(flusher); }

      if (cap.status >= 400) throw new Error(cap.errorBody || `provider error ${cap.status}`);
      const toolCalls = Object.values(calls).filter((c) => c.name);
      if (!toolCalls.length) break;

      history.push({
        role: 'assistant',
        content: turnText,
        tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments || '{}' } })),
      });
      for (const c of toolCalls) {
        let args = {};
        try { args = JSON.parse(c.arguments || '{}'); } catch { /* keep empty */ }
        let result = '';
        if (c.name === 'web_search' && args.query) {
          emit({ type: 'tool_query', name: 'web_search', query: String(args.query) });
          const s = await runSearch(String(args.query));
          sources.push(...s.sources);
          toolLog.push({ name: 'web_search', query: String(args.query), results: s.sources.length });
          emit({ type: 'tool_done', name: 'web_search', query: String(args.query), sources: s.sources });
          result = s.text;
        } else {
          toolLog.push({ name: c.name, skipped: true });
          result = JSON.stringify({ note: `${c.name} is not available in background mode yet. Answer without it.` });
        }
        history.push({ role: 'tool', tool_call_id: c.id, content: result });
      }
      await flush(true);
    }
    status = 'done';
    if (!content.trim()) { content = 'I could not produce a reply this time. Please try again.'; emit({ type: 'content', delta: content }); }
    await flush(true);
    emit({ type: 'done' });
  } catch (e) {
    status = 'error';
    if (!content.trim()) content = 'Something went wrong while generating this reply. Please try again.';
    await flush(true, { error: String(e?.message || e).slice(0, 300) });
    emit({ type: 'error', message: content });
  }
}

async function patchRow(token, id, userId, fields) {
  await sb(`/rest/v1/ai_messages?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Sign in to use background chats.' });
  const user = await getUser(token);
  if (!user) return res.status(401).json({ error: 'Session expired. Sign in again.' });

  const { chat_id: chatId, messages } = req.body || {};
  if (!chatId || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'chat_id and messages are required' });

  const wantsStream = req.body?.stream_events === true;
  const um = req.body?.user_message;
  const hasUm = !!(um && um.id && typeof um.content === 'string');
  const now = Date.now();

  let emit = () => {};
  let clientGone = false;
  if (wantsStream) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    emit = (evt) => {
      if (clientGone) return;
      try { res.write(`data: ${JSON.stringify(evt)}\n\n`); } catch { clientGone = true; }
    };
    res.on?.('close', () => { clientGone = true; });
  }

  // Saving the chat, the user's row and the placeholder reply runs alongside the model call.
  const rowP = (async () => {
    if (hasUm) {
      const chatIns = await sb('/rest/v1/ai_chats?on_conflict=id', token, {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ id: chatId, user_id: user.id, title: String(req.body?.title || 'New chat').slice(0, 80), metadata: {} }),
      });
      if (!chatIns.ok) throw new Error('Could not open chat: ' + (await chatIns.text()).slice(0, 160));
    }
    const userRowP = hasUm
      ? sb('/rest/v1/ai_messages?on_conflict=id', token, {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ id: um.id, chat_id: chatId, user_id: user.id, role: 'user', content: um.content, metadata: um.mode ? { mode: um.mode } : {}, created_at: new Date(now - 100).toISOString() }),
        })
      : Promise.resolve(null);
    const insP = sb('/rest/v1/ai_messages', token, {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, user_id: user.id, role: 'assistant', content: '', metadata: { status: 'streaming', started_at: new Date(now).toISOString() } }),
    });
    const [userRes, ins] = await Promise.all([userRowP, insP]);
    if (userRes && !userRes.ok) throw new Error('Could not save message');
    if (!ins.ok) throw new Error('Could not start run');
    const row = (await ins.json())[0];
    emit({ type: 'meta', message_id: row.id });
    return row.id;
  })();
  rowP.catch(() => {});

  if (!wantsStream) {
    try { await rowP; } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
  }
  const work = runGeneration({ token, messageId: rowP, userId: user.id, body: req.body, emit });
  let usedWaitUntil = false;
  try {
    const mod = await import('@vercel/functions');
    if (mod.waitUntil) { mod.waitUntil(work); usedWaitUntil = true; }
  } catch { /* not on Vercel or package missing */ }

  if (wantsStream) {
    await work;
    try { res.end(); } catch { /* closed */ }
    return;
  }
  const messageId = await rowP;
  if (usedWaitUntil) return res.status(202).json({ message_id: messageId, status: 'streaming' });
  // Fallback: hold the request open until the run finishes (still survives tab close).
  await work;
  return res.status(200).json({ message_id: messageId, status: 'done' });
}
