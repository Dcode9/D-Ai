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

function audioResponse(stream, contentType) {
  return new Response(stream, {
    headers: {
      'Content-Type': contentType || 'audio/mpeg',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS
    }
  });
}

function toDuration(value, fallback = 15) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(300, Math.max(3, Math.round(parsed)));
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const { prompt, duration, style, model } = await req.json();
    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return jsonResponse({ error: 'Configuration Error: POLLINATIONS_API key is missing.' }, 500);
    }

    const promptText = typeof prompt === 'string' ? prompt.trim() : '';
    const styleText = typeof style === 'string' ? style.trim() : '';
    const finalPrompt = [promptText || 'ambient cinematic instrumental', styleText].filter(Boolean).join(', ');
    const finalModel = model && String(model).trim() ? String(model).trim() : 'acestep';
    const finalDuration = toDuration(duration, 15);

    const params = new URLSearchParams({
      model: finalModel,
      duration: String(finalDuration)
    });
    if (styleText) params.set('style', styleText);

    const pollinationsUrl = `https://gen.pollinations.ai/audio/${encodeURIComponent(finalPrompt)}?${params.toString()}`;
    const audioRes = await fetch(pollinationsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'audio/mpeg,audio/*,application/json'
      }
    });

    if (!audioRes.ok) {
      const detail = await audioRes.text().catch(() => audioRes.statusText);
      return jsonResponse({ error: `Pollinations audio error (${audioRes.status}): ${detail || audioRes.statusText}` }, audioRes.status);
    }

    const contentType = audioRes.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const payload = await audioRes.json();
      const url = payload?.url || payload?.audio || payload?.output?.url || payload?.data?.[0]?.url;
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        const resolved = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'audio/mpeg,audio/*'
          }
        });
        if (resolved.ok) return audioResponse(resolved.body, resolved.headers.get('Content-Type') || 'audio/mpeg');
        return jsonResponse({ error: `Failed to resolve generated audio (${resolved.status}).` }, resolved.status);
      }
      return jsonResponse({ error: 'Pollinations returned JSON without an audio URL.', debug: payload }, 502);
    }

    return audioResponse(audioRes.body, contentType || 'audio/mpeg');
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
