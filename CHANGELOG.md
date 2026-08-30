# D'Ai Changelog

## 1.1.0 — Hardening & Improvements

This release addresses 10 identified issues and adds 10 improvements across the
backend and frontend of D'Ai. Nothing changes in the user experience unless
explicitly noted.

### Security & Stability Fixes (Issues)

**Backend**
- `server.js`: Per-route body size limits (256 KB chat, 32 KB search, 64 KB image,
  128 KB upload) replace the previous 50 MB global cap. Closes a DoS vector.
- `server.js`: In-memory rate limiter (60/min chat, 30/min search, 20/min image,
  10/min upload) added to every API route. Returns 429 + `X-RateLimit-*` headers.
- `server.js`: Security headers added — `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`. Optional `ALLOWED_ORIGIN` env var
  replaces the always-`*` CORS rule.
- `api/chat.js`: Full input validation on POST — message-array shape, role
  whitelist, per-message and aggregate size caps, provider/model whitelist,
  temperature / max_tokens bounds. Returns 400 with a clear message on violation.
- `api/search.js`: Replaced with a complete rewrite that adds CORS headers, an
  OPTIONS handler, timeouts, URL validation, two-fallback parsing of DDG
  results, and a 500-character query limit.
- `api/image.js`: Provider enum, prompt size, and image-dimension validation.
  Refactored to deduplicate the `CORS_HEADERS` block.
- `api/upload.js`: Server-side pathname sanitization (directory traversal +
  control-character removal), tightened max size to 25 MB, explicit
  `maximumSizeInBytes` enforcement, structured error logs.
- `api/interface.js`: OPTIONS handler, type whitelist, prompt length limit,
  outer try/catch around the fallback model so a secondary failure returns 502
  instead of crashing the route.

**Frontend**
- `index.html`: Removed the duplicate Tailwind CDN script (the local
  `/styles/tailwind.css` is the source of truth) and added a strict
  Content-Security-Policy meta tag with the actual connect-src / script-src /
  font-src allowlist used by the app.
- Removed `test.js`, `test2.js`, `test3.js`, `mock.js` — none were referenced
  anywhere in `index.html` and they shipped ~10K lines of dead code.
- `scripts/dverseClient.js`: Added a console warning when the app falls back to
  the hard-coded Supabase project, so production deployers know to override
  `window.DVERSE_SUPABASE_URL` and `window.DVERSE_SUPABASE_KEY`.

### New Features (Improvements)

**Backend**
- Per-request ID middleware (UUID + `X-Request-Id` header) plus structured
  JSON request logs in `server.js` and every API route. Makes production
  debugging dramatically easier.
- Graceful shutdown handler for `SIGTERM` / `SIGINT` in `server.js` (10-second
  drain, force exit after).
- Stale-bucket cleanup task for the in-memory rate limiter (every 5 minutes)
  to prevent unbounded memory growth.
- `api/chat.js`, `api/search.js`, `api/image.js`, `api/interface.js`: All set
  `Cache-Control: no-store` on streamed / dynamic responses (where applicable)
  and return consistent JSON error shapes with a human-readable `error` field.

**Frontend**
- New connection-health indicator in the header (🟢/🟡/🔴 dot + provider name
  + measured latency) that pings `/api/chat` every 60s and on window focus.
  Visible feedback when the server is unreachable.
- New global error boundary. Catches uncaught exceptions and unhandled promise
  rejections, shows a dismissable overlay with the error message + stack
  (when Dev Mode is unlocked), and otherwise surfaces a friendly toast.
- New `localStorage.setItem` quota wrapper that fires a toast and a
  `dai:storage-quota` event when the browser storage is full, instead of
  throwing an uncaught exception that breaks the chat.
- `index.html`: Header now has a single CSP `meta` tag with explicit
  `connect-src` for Groq / Inception / Cloudflare / Tavily / Pollinations /
  Vercel Blob / Supabase / D-verse — restated as the canonical security
  policy.
- New `.env.example` documenting every environment variable the server
  understands, with comments.
- New `npm run check` script in `package.json` — runs `node --check` on every
  server file to catch syntax regressions in CI.

### Operational

- Bumped `package.json` to `1.1.0` and added Node `engines` requirement
  (`>=18.0.0`).
- All changes preserve the existing public API and the user-facing UI
  unchanged.
