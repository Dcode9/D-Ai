export const config = {
  runtime: 'edge',
};

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const POLLINATIONS_UPLOAD_ENDPOINTS = [
  'https://media.pollinations.ai/upload',
  'https://gen.pollinations.ai/upload'
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

  try {
    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return jsonResponse({ error: "Configuration Error: POLLINATIONS_API key is missing." }, 401);
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return jsonResponse({ error: "No file provided" }, 400);
    }

    if (!file.type || !file.type.startsWith('image/')) {
      return jsonResponse({ error: "Only image uploads are supported for vision." }, 400);
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return jsonResponse({ error: "Image must be under 50 MB." }, 413);
    }

    let payload = null;
    let lastError = null;

    for (const endpoint of POLLINATIONS_UPLOAD_ENDPOINTS) {
      const uploadData = new FormData();
      uploadData.append('file', file, file.name || 'upload');

      const uploadRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: uploadData,
      });

      if (uploadRes.ok) {
        payload = await uploadRes.json();
        break;
      }

      let detail = uploadRes.statusText;
      try {
        const errorPayload = await uploadRes.json();
        detail = typeof errorPayload.error === 'string'
          ? errorPayload.error
          : errorPayload.error?.message || JSON.stringify(errorPayload);
      } catch (e) {}

      lastError = {
        endpoint,
        status: uploadRes.status,
        detail
      };
    }

    if (!payload) {
      return jsonResponse({
        error: `Upload Service Error (${lastError?.status || 502}): ${lastError?.detail || 'Unable to upload media.'}`,
        endpoint: lastError?.endpoint
      }, lastError?.status || 502);
    }

    if (!payload.url) {
      return jsonResponse({ error: "Upload Service Error: Missing uploaded media URL." }, 502);
    }

    return jsonResponse({
      success: true,
      link: payload.url,
      id: payload.id,
      size: payload.size,
      contentType: payload.contentType,
      duplicate: payload.duplicate
    });

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
