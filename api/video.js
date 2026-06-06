export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function mediaResponse(stream, contentType) {
  return new Response(stream, {
    headers: {
      'Content-Type': contentType || 'video/mp4',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS
    }
  });
}

function toDuration(value, fallback = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(1, Math.round(parsed)));
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const { prompt, width, height, duration, aspectRatio, model, image } = await req.json();
    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return jsonResponse({ error: 'Configuration Error: POLLINATIONS_API key is missing.' }, 500);
    }

    const finalPrompt = typeof prompt === 'string' && prompt.trim() ? prompt.trim() : 'abstract cinematic video';
    const finalModel = typeof model === 'string' && model.trim() ? model.trim() : 'seedance';
    const finalDuration = toDuration(duration, 4);
    const finalAspectRatio = typeof aspectRatio === 'string' && aspectRatio.trim() ? aspectRatio.trim() : '16:9';

    const params = new URLSearchParams({
      model: finalModel,
      duration: String(finalDuration),
      aspectRatio: finalAspectRatio,
      nologo: 'true'
    });
    if (width) params.set('width', String(width));
    if (height) params.set('height', String(height));
    if (image && String(image).trim()) params.set('image', String(image).trim());

    const pollinationsUrl = `https://gen.pollinations.ai/video/${encodeURIComponent(finalPrompt)}?${params.toString()}`;
    const videoRes = await fetch(pollinationsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'video/mp4,video/*,application/json'
      }
    });

    if (!videoRes.ok) {
      const detail = await videoRes.text().catch(() => videoRes.statusText);
      return jsonResponse({ error: `Pollinations video error (${videoRes.status}): ${detail || videoRes.statusText}` }, videoRes.status);
    }

    const contentType = videoRes.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const payload = await videoRes.json();
      const url = payload?.url || payload?.video || payload?.output?.url || payload?.data?.[0]?.url;
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        const resolved = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'video/mp4,video/*'
          }
        });
        if (resolved.ok) return mediaResponse(resolved.body, resolved.headers.get('Content-Type') || 'video/mp4');
        return jsonResponse({ error: `Failed to resolve generated video (${resolved.status}).` }, resolved.status);
      }
      return jsonResponse({ error: 'Pollinations returned JSON without a video URL.', debug: payload }, 502);
    }

    return mediaResponse(videoRes.body, contentType || 'video/mp4');
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
