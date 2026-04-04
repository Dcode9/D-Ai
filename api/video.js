export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, model } = await req.json();

    const finalPrompt = prompt && prompt.trim() ? prompt : "abstract video";
    const finalModel = model || 'nova-reel';

    // 1. Construct Base URL for video generation
    // Pollinations video endpoint - using image.pollinations.ai with video model
    const baseUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}`;

    // 2. Build Query Parameters
    const params = new URLSearchParams();
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    params.append('model', finalModel);
    params.append('nologo', 'true');

    const url = `${baseUrl}?${params.toString()}`;

    console.log('Video API Request URL:', url);

    // 3. Fetch from Pollinations
    const videoRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'video/mp4,video/*,*/*'
      }
    });

    console.log('Video API Response Status:', videoRes.status);
    console.log('Video API Response Content-Type:', videoRes.headers.get('Content-Type'));

    if (!videoRes.ok) {
      let errorMessage = videoRes.statusText;
      try {
        const text = await videoRes.text();
        console.log('Video API Error Response:', text);
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

    // Check if we actually got a video
    const contentType = videoRes.headers.get('Content-Type') || '';
    console.log('Received Content-Type:', contentType);

    if (!contentType.includes('video')) {
      return new Response(JSON.stringify({
        error: `Invalid response: Expected video but got ${contentType}. The model '${finalModel}' may not support video generation, or the endpoint may be incorrect.`
      }), {
        status: 400,
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
