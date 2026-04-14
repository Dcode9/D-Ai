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

const AUDIO_FORMAT_MIME = {
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/L16'
};

function toResponseFormat(value, fallback = 'mp3') {
  if (!value) return fallback;
  const format = String(value).trim().toLowerCase();
  if (!(format in AUDIO_FORMAT_MIME)) {
    throw new Error('Invalid response_format. Use one of: mp3, opus, aac, flac, wav, pcm.');
  }
  return format;
}

// Accepts common boolean representations from clients: boolean, "true"/"false", 1/0.
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
    let finalFormat = 'mp3';
    try {
      finalFormat = toResponseFormat(response_format, 'mp3');
    } catch (error) {
      return jsonResponse({ error: error.message }, 400);
    }
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
    if (instrumentalValue !== null) {
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
        'Content-Type': pollinationsRes.headers.get('content-type') || AUDIO_FORMAT_MIME[finalFormat] || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
