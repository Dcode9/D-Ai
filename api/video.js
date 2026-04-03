export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, duration, aspectRatio, model } = await req.json();

    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: POLLINATIONS_API key is missing." }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalPrompt = prompt && prompt.trim() ? prompt : "abstract video";
    const finalModel = model || 'ltx-2';

    // 1. Construct Base URL for video generation
    const baseUrl = `https://gen.pollinations.ai/video/${encodeURIComponent(finalPrompt)}`;

    // 2. Build Query Parameters
    const params = new URLSearchParams();
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    if (duration) params.append('duration', duration);
    if (aspectRatio) params.append('aspectRatio', aspectRatio);
    params.append('model', finalModel);
    params.append('nologo', 'true');

    const url = `${baseUrl}?${params.toString()}`;

    // 3. Fetch from Pollinations
    const videoRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'video/*'
      }
    });

    if (!videoRes.ok) {
      let errorMessage = videoRes.statusText;
      try {
        const text = await videoRes.text();
        if (text.trim().startsWith('{')) {
            const json = JSON.parse(text);
            errorMessage = JSON.stringify(json);
        } else {
            errorMessage = `Request blocked (${videoRes.status}). content filter or invalid param.`;
        }
      } catch (e) { }

      return new Response(JSON.stringify({ error: `Pollinations API Error (${videoRes.status}): ${errorMessage}` }), {
        status: videoRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(videoRes.body, {
      headers: {
        'Content-Type': videoRes.headers.get('Content-Type') || 'video/mp4',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
