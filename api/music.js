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
    const { prompt, duration } = await req.json();
    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return jsonResponse({ error: 'Configuration Error: POLLINATIONS_API key is missing.' }, 500);
    }

    const promptText = typeof prompt === 'string' ? prompt.trim() : '';
    const finalPrompt = promptText || 'ambient cinematic instrumental';
    const finalModel = 'acestep';
    const finalDuration = toDuration(duration, 15);

    const baseUrl = `https://gen.pollinations.ai/audio/${encodeURIComponent(finalPrompt)}`;
    const params = new URLSearchParams();
    params.append('model', finalModel);
    params.append('duration', String(finalDuration));
    const url = `${baseUrl}?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let pollRes;
    try {
      pollRes = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'audio/mpeg,audio/*'
        },
        signal: controller.signal
      });
    } catch (err) {
      const aborted = err && err.name === 'AbortError';
      return jsonResponse(
        { error: aborted ? 'Pollinations timed out while generating audio.' : `Request failed: ${err.message || err}` },
        aborted ? 504 : 502
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!pollRes.ok) {
      let detail = pollRes.statusText;
      try {
        const text = await pollRes.text();
        if (text) detail = text;
      } catch (e) {}
      return jsonResponse({ error: `Pollinations error (${pollRes.status}): ${detail}` }, pollRes.status);
    }

    const contentType = pollRes.headers.get('content-type') || 'audio/mpeg';
    return new Response(pollRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
