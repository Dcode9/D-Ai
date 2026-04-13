export const config = {
  runtime: 'edge',
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function toDuration(value, fallback = 15) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(300, Math.max(3, Math.round(parsed)));
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, duration, style, model } = await req.json();

    const apiKey = process.env.POLLINATIONS_API;
    if (!apiKey) {
      return jsonResponse({ error: 'Configuration Error: POLLINATIONS_API key is missing.' }, 500);
    }

    const finalPrompt = prompt && String(prompt).trim() ? String(prompt).trim() : 'ambient cinematic instrumental';
    const finalModel = model && String(model).trim() ? String(model).trim() : 'acestep';
    const finalDuration = toDuration(duration, 15);

    const baseUrl = `https://gen.pollinations.ai/audio/${encodeURIComponent(finalPrompt)}`;
    const params = new URLSearchParams();
    params.append('model', finalModel);
    params.append('duration', String(finalDuration));
    if (style && String(style).trim()) {
      params.append('style', String(style).trim());
    }

    const url = `${baseUrl}?${params.toString()}`;
    const audioRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'audio/mpeg,audio/*'
      }
    });

    if (!audioRes.ok) {
      let detail = audioRes.statusText;
      try {
        const text = await audioRes.text();
        detail = text || detail;
      } catch (e) {}

      return jsonResponse({ error: `Pollinations API Error (${audioRes.status}): ${detail}` }, audioRes.status);
    }

    return new Response(audioRes.body, {
      headers: {
        'Content-Type': audioRes.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
