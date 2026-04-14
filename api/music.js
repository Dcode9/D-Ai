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
    return jsonResponse({ url, apiKey });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
