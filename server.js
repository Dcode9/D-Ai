import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import chatHandler from './api/chat.js';
import imageHandler from './api/image.js';
import interfaceHandler from './api/interface.js';
import musicHandler from './api/music.js';
import searchHandler from './api/search.js';
import uploadHandler from './api/upload.js';
import videoHandler from './api/video.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function createWebRequest(req) {
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

  const init = {
    method: req.method,
    headers
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  return new Request(url, init);
}

function adaptWebHandler(handler) {
  return async (req, res) => {
    try {
      const webReq = createWebRequest(req);
      const webRes = await handler(webReq);

      res.status(webRes.status);
      webRes.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });

      if (webRes.body) {
        const reader = webRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.end();
      }
    } catch (err) {
      console.error('API Error:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  };
}

// API Routes
app.all('/api/chat', chatHandler);
app.all('/api/upload', uploadHandler);

app.all('/api/image', adaptWebHandler(imageHandler));
app.all('/api/interface', adaptWebHandler(interfaceHandler));
app.all('/api/music', adaptWebHandler(musicHandler));
app.all('/api/search', adaptWebHandler(searchHandler));
app.all('/api/video', adaptWebHandler(videoHandler));

// Serve static files
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing
app.get('*all', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`D'Ai Server running on http://0.0.0.0:${PORT}`);
});
