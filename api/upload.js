import { handleUpload } from '@vercel/blob/client';

const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // tightened from 50MB to 25MB
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

function sendJson(res, payload, status = 200) {
  res.status(status).json(payload);
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); }
    catch (e) { return {}; }
  }
  return body;
}

function makeUploadRequest(req, body) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url || '/api/upload'}`;
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return sendJson(res, { available: !!process.env.BLOB_READ_WRITE_TOKEN });
  }
  if (req.method !== 'POST') return sendJson(res, { error: 'Method Not Allowed' }, 405);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sendJson(res, {
      error: 'Configuration Error: connect a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.'
    }, 500);
  }

  try {
    const body = normalizeBody(req.body);

    const response = await handleUpload({
      body,
      request: makeUploadRequest(req, body),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Always validate the client-supplied size and contentType BEFORE the
        // token is issued. The actual upload will be re-validated by Vercel Blob
        // when the bytes arrive, so this is just an early guard.
        let payload = {};
        if (clientPayload) {
          try { payload = JSON.parse(clientPayload); } catch (e) { payload = {}; }
        }

        const size = Number(payload.size || 0);
        const contentType = String(payload.contentType || '').toLowerCase().trim();

        if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
          throw new Error('Only JPEG, PNG, WebP, GIF, and AVIF images are supported.');
        }
        if (!Number.isFinite(size) || size <= 0) {
          throw new Error('Invalid upload size.');
        }
        if (size > MAX_IMAGE_SIZE) {
          throw new Error(`Image must be under ${MAX_IMAGE_SIZE / 1024 / 1024} MB.`);
        }

        // Sanitize the pathname: strip directory traversal, control characters
        const safeName = String(pathname || 'upload')
          .replace(/[\x00-\x1f\x7f]/g, '')
          .replace(/\.\.+/g, '')
          .replace(/^[\\/]+/, '')
          .slice(0, 120) || 'upload';

        return {
          allowedContentTypes: Array.from(ALLOWED_IMAGE_TYPES),
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_IMAGE_SIZE,
          tokenPayload: JSON.stringify({ contentType, size }),
          pathname: `uploads/${safeName}`
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[Upload] Vercel Blob upload completed:', {
          pathname: blob.pathname,
          contentType: blob.contentType,
          size: blob.size
        });
      }
    });

    return sendJson(res, response);
  } catch (error) {
    console.error('[Upload] Error:', error.message);
    return sendJson(res, { error: error.message }, 400);
  }
}
