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

export async function runGeneration({ token, messageId, userId, body, patch = patchRow }) {
  const history = Array.isArray(body.messages) ? [...body.messages] : [];
  let content = '';
  let thinking = '';
  const sources = [];
  const toolLog = [];
  let lastFlush = 0;
  let status = 'streaming';

  const flush = async (force = false, extra = {}) => {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    lastFlush = now;
    await patch(token, messageId, userId, {
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
        if (think) thinking += think;
        if (delta.content) { turnText += delta.content; content += delta.content; }
        for (const tc of delta.tool_calls || []) {
          const i = tc.index ?? 0;
          calls[i] = calls[i] || { id: tc.id || `call_${loop}_${i}`, name: '', arguments: '' };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function?.name) calls[i].name = tc.function.name;
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
          const s = await runSearch(String(args.query));
          sources.push(...s.sources);
          toolLog.push({ name: 'web_search', query: String(args.query), results: s.sources.length });
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
    if (!content.trim()) content = 'I could not produce a reply this time. Please try again.';
    await flush(true);
  } catch (e) {
    status = 'error';
    if (!content.trim()) content = 'Something went wrong while generating this reply. Please try again.';
    await flush(true, { error: String(e?.message || e).slice(0, 300) });
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

  // The placeholder row is what every device watches.
  const ins = await sb('/rest/v1/ai_messages', token, {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, user_id: user.id, role: 'assistant', content: '', metadata: { status: 'streaming', started_at: new Date().toISOString() } }),
  });
  if (!ins.ok) return res.status(502).json({ error: 'Could not start run', detail: (await ins.text()).slice(0, 200) });
  const row = (await ins.json())[0];

  const work = runGeneration({ token, messageId: row.id, userId: user.id, body: req.body });
  let usedWaitUntil = false;
  try {
    const mod = await import('@vercel/functions');
    if (mod.waitUntil) { mod.waitUntil(work); usedWaitUntil = true; }
  } catch { /* not on Vercel or package missing */ }

  if (usedWaitUntil) return res.status(202).json({ message_id: row.id, status: 'streaming' });
  // Fallback: hold the request open until the run finishes (still survives tab close).
  await work;
  return res.status(200).json({ message_id: row.id, status: 'done' });
}
