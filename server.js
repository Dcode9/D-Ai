import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

import chatHandler from './api/chat.js';
import imageHandler from './api/image.js';
import interfaceHandler from './api/interface.js';
import searchHandler from './api/search.js';
import uploadHandler from './api/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// ---------- Lightweight in-memory rate limiter ----------
// (Replaces missing express-rate-limit; for multi-instance deploys swap in Redis.)
const RATE_BUCKETS = new Map();
const RATE_LIMITS = {
    '/api/chat':     { windowMs: 60_000, max: 60 },   // 60 req/min per IP
    '/api/image':    { windowMs: 60_000, max: 20 },   // 20 req/min
    '/api/search':   { windowMs: 60_000, max: 30 },   // 30 req/min
    '/api/interface':{ windowMs: 60_000, max: 30 },
    '/api/upload':   { windowMs: 60_000, max: 10 }
};
const rateLimit = (routeKey) => (req, res, next) => {
    const cfg = RATE_LIMITS[routeKey];
    if (!cfg) return next();
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || 'unknown';
    const key = `${routeKey}:${ip}`;
    const now = Date.now();
    const bucket = RATE_BUCKETS.get(key);
    if (!bucket || now - bucket.start >= cfg.windowMs) {
        RATE_BUCKETS.set(key, { start: now, count: 1 });
        return next();
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(cfg.max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, cfg.max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.start + cfg.windowMs - now) / 1000)));
    if (bucket.count > cfg.max) {
        return res.status(429).json({
            error: 'Too many requests. Please slow down and retry shortly.',
            retryAfterSeconds: Math.ceil((bucket.start + cfg.windowMs - now) / 1000)
        });
    }
    next();
};
// Cleanup stale buckets every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, b] of RATE_BUCKETS) {
        if (now - b.start > 5 * 60_000) RATE_BUCKETS.delete(key);
    }
}, 5 * 60_000).unref?.();

// ---------- CORS (locked to env-configured origin in prod, * in dev) ----------
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use((req, res, next) => {
    const origin = ALLOWED_ORIGIN === '*' ? '*' : ALLOWED_ORIGIN;
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (origin !== '*') res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

// ---------- Security headers ----------
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// ---------- Request ID + structured logging ----------
app.use((req, res, next) => {
    const reqId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', reqId);
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(JSON.stringify({
            level: 'info', reqId, method: req.method, path: req.originalUrl || req.url,
            status: res.statusCode, durationMs: ms, ip: req.ip || 'unknown'
        }));
    });
    next();
});

// ---------- Per-route body limits ----------
// Chat & search are small JSON; image carries the prompt only; upload needs the bigger limit.
const chatParser = express.json({ limit: '256kb' });
const searchParser = express.json({ limit: '32kb' });
const imageParser = express.json({ limit: '64kb' });
const interfaceParser = express.json({ limit: '64kb' });
const uploadParser = express.json({ limit: '128kb' });

function createWebRequest(req, requestId) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['host'] || 'localhost:3000';
    const url = `${protocol}://${host}${req.originalUrl || req.url}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
            if (Array.isArray(value)) {
                value.forEach(v => headers.append(key, v));
            } else {
                headers.set(key, value);
            }
        }
    }
    if (requestId) headers.set('x-request-id', requestId);

    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    return new Request(url, init);
}

// adapt a Web-Fetch-style handler to Express
function adaptWebHandler(handler) {
    return async (req, res) => {
        // CRITICAL: silence stray response errors. Without this, a write
        // after the response is closed becomes an unhandled error and
        // crashes the Node process.
        res.on('error', (e) => {
            try {
                console.error(JSON.stringify({
                    level: 'warn', scope: 'response.error',
                    message: e?.message || String(e)
                }));
            } catch { /* noop */ }
        });
        try {
            const requestId = res.getHeader('X-Request-Id') || crypto.randomUUID();
            const webReq = createWebRequest(req, requestId);
            const webRes = await handler(webReq);
            res.status(webRes.status);
            webRes.headers.forEach((val, key) => {
                try { res.setHeader(key, val); } catch { /* ignore restricted headers */ }
            });
            if (webRes.body) {
                const reader = webRes.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
            }
            res.end();
        } catch (err) {
            const reqId = res.getHeader('X-Request-Id');
            try {
                console.error(JSON.stringify({ level: 'error', reqId, scope: 'adaptWebHandler', message: err.message, stack: err.stack }));
            } catch { /* noop */ }
            if (!res.headersSent) {
                try { res.status(500).json({ error: 'Internal Server Error', requestId: reqId }); }
                catch { try { res.end(); } catch { /* noop */ } }
            } else {
                try { res.end(); } catch { /* socket gone */ }
            }
        }
    };
}

// ---- API routes ----
app.all('/api/chat', rateLimit('/api/chat'), chatParser, chatHandler);
app.all('/api/upload', rateLimit('/api/upload'), uploadParser, uploadHandler);
app.all('/api/image', rateLimit('/api/image'), imageParser, adaptWebHandler(imageHandler));
app.all('/api/interface', rateLimit('/api/interface'), interfaceParser, adaptWebHandler(interfaceHandler));
app.all('/api/search', rateLimit('/api/search'), searchParser, adaptWebHandler(searchHandler));

// Static files with sensible caching
app.use(express.static(__dirname, {
    setHeaders(res, filePath) {
        if (/\.(?:js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|gif|ico)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

// SPA fallback
app.get('*all', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ level: 'info', message: `D'Ai Server running on http://0.0.0.0:${PORT}`, port: PORT }));
});

// ---------- Global safety nets ----------
// Without these, a single rogue response write (e.g.
// `ERR_STREAM_WRITE_AFTER_END` from a path that closed the response
// twice) becomes an unhandled `error` event on the response's
// EventEmitter and crashes the entire Node process, which then
// makes every subsequent request fail with "connection refused".
// We log and keep running.
process.on('uncaughtException', (err) => {
    try {
        console.error(JSON.stringify({
            level: 'error', scope: 'uncaughtException',
            message: err?.message || String(err),
            stack: err?.stack
        }));
    } catch { /* nothing to do */ }
});
process.on('unhandledRejection', (reason) => {
    try {
        const msg = reason?.stack || reason?.message || String(reason);
        console.error(JSON.stringify({
            level: 'error', scope: 'unhandledRejection',
            message: msg
        }));
    } catch { /* nothing to do */ }
});
// Belt-and-braces: if any active socket emits an error we just log it
// instead of crashing.
server.on('clientError', (err, socket) => {
    try {
        console.error(JSON.stringify({
            level: 'warn', scope: 'server.clientError',
            message: err?.message || String(err)
        }));
    } catch { /* noop */ }
    if (socket && socket.writable) {
        try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { /* noop */ }
    }
});

// Graceful shutdown
const shutdown = (sig) => {
    console.log(JSON.stringify({ level: 'info', message: `Received ${sig}, shutting down gracefully` }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
