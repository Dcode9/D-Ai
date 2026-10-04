// Shared request guards: input validation and a best-effort per-IP rate limit.
const ROLES = new Set(['system', 'user', 'assistant', 'tool', 'function', 'developer']);
const hits = new Map();

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

/** Returns true when the caller is over the limit. In-memory, so it is per warm instance. */
export function rateLimited(req, limit = 90, windowMs = 60000) {
  const now = Date.now();
  const ip = clientIp(req);
  const rec = hits.get(ip);
  if (!rec || now - rec.t > windowMs) {
    hits.set(ip, { t: now, n: 1 });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > windowMs) hits.delete(k);
    return false;
  }
  rec.n++;
  return rec.n > limit;
}

/** Returns an error string, or null when the messages look sane. */
export function badMessages(messages, { maxCount = 200, maxChars = 600000 } = {}) {
  if (!Array.isArray(messages)) return 'messages must be an array';
  if (messages.length > maxCount) return 'too many messages';
  let total = 0;
  for (const m of messages) {
    if (!m || typeof m !== 'object' || !ROLES.has(m.role)) return 'invalid message role';
    try { total += typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content ?? '').length; } catch { return 'invalid message content'; }
    if (total > maxChars) return 'conversation too large';
  }
  return null;
}
