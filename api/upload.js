export const config = {
  runtime: 'edge',
};

import { handleUpload } from '@vercel/blob/client';

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return jsonResponse({
      error: 'Configuration Error: connect a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.'
    }, 500);
  }

  try {
    const body = await req.json();

    const response = await handleUpload({
      body,
      request: req,
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

    return jsonResponse(response);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }
}
