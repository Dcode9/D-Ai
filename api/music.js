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

function toInstrumentalString(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 'true' || value === 1 || value === '1') return 'true';
  if (value === false || value === 'false' || value === 0 || value === '0') return 'false';
  throw new Error('Invalid instrumental value. Use true or false.');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, duration, style, model, instrumental, response_format } = await req.json();
    const apiKey = process.env.POLLINATIONS_API;

    if (!apiKey) {
      return jsonResponse({ error: 'Configuration Error: POLLINATIONS_API key is missing.' }, 500);
    }

    const promptText = typeof prompt === 'string' ? prompt.trim() : '';
    const finalPrompt = promptText || 'ambient cinematic instrumental';
    const finalModel = model && String(model).trim() ? String(model).trim() : 'elevenmusic';
    const finalDuration = toDuration(duration, 15);
    const finalFormat = response_format && String(response_format).trim() ? String(response_format).trim() : 'mp3';
    let instrumentalValue = null;
    try {
      instrumentalValue = toInstrumentalString(instrumental);
    } catch (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const baseUrl = `https://gen.pollinations.ai/audio/${encodeURIComponent(finalPrompt)}`;
    const params = new URLSearchParams();
    params.append('model', finalModel);
    params.append('duration', String(finalDuration));
    params.append('response_format', finalFormat);
    if (instrumentalValue) {
      params.append('instrumental', instrumentalValue);
    }
    if (style && String(style).trim()) {
      params.append('style', String(style).trim());
    }

    const url = `${baseUrl}?${params.toString()}`;
    const pollinationsRes = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'audio/*'
      }
    });

    if (!pollinationsRes.ok) {
      let detail = pollinationsRes.statusText;
      try {
        const text = await pollinationsRes.text();
        if (text) detail = text;
      } catch {}
      return jsonResponse({ error: `Pollinations API Error (${pollinationsRes.status}): ${detail}` }, pollinationsRes.status);
    }

    const audioBuffer = await pollinationsRes.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': pollinationsRes.headers.get('content-type') || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
