export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, duration, aspectRatio, model, image } = await req.json();

    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: POLLINATIONS_API key is missing." }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalPrompt = prompt && prompt.trim() ? prompt : "abstract video";
    const finalModel = model || 'nova-reel';
    const finalDuration = duration || 4;
    const finalAspectRatio = aspectRatio || '16:9';

    // Construct the Pollinations video URL
    const baseUrl = `https://gen.pollinations.ai/video/${encodeURIComponent(finalPrompt)}`;

    // Build Query Parameters
    const params = new URLSearchParams();
    params.append('model', finalModel);
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    params.append('duration', finalDuration);
    params.append('aspectRatio', finalAspectRatio);
    params.append('nologo', 'true');

    // Add image parameter if provided (for image-to-video generation)
    if (image) {
      params.append('image', image);
    }

    const url = `${baseUrl}?${params.toString()}`;

    console.log('Generated Video URL:', url);

    // Return the URL and API key to the frontend
    // Frontend will fetch directly from Pollinations to avoid Vercel Hobby 10s timeout
    return new Response(JSON.stringify({
      url: url,
      apiKey: apiKey
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
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
