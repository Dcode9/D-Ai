import { handleUpload } from '@vercel/blob/client';

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
];

function sendJson(res, payload, status = 200) {
  res.status(status).json(payload);
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      return {};
    }
  }
  return body;
}

function makeUploadRequest(req, body) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url || '/api/upload'}`;
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'Method Not Allowed' }, 405);
  }

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
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const size = Number(payload.size || 0);
        const contentType = String(payload.contentType || '');

        if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
          throw new Error('Only JPEG, PNG, WebP, GIF, and AVIF images are supported.');
        }

        if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_SIZE) {
          throw new Error('Image must be under 50 MB.');
        }

        return {
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            contentType,
            size
          })
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[Upload] Private Vercel Blob upload completed:', {
          pathname: blob.pathname,
          contentType: blob.contentType,
          size: blob.size
        });
      }
    });

    return sendJson(res, response);
  } catch (error) {
    return sendJson(res, { error: error.message }, 400);
  }
}
