export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model, image } = await req.json();
    
    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API; 

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: POLLINATIONS_API key is missing." }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalPrompt = prompt && prompt.trim() ? prompt : "abstract art";
    const finalModel = model || 'nanobanana';
    
    // 1. Construct Base URL
    const baseUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(finalPrompt)}`;
    
    // 2. Build Query Parameters
    const params = new URLSearchParams();
    params.append('width', width);
    params.append('height', height);
    params.append('seed', seed);
    params.append('model', finalModel);
    params.append('nologo', 'true');
    params.append('safe', 'false'); // Explicitly disable safety filter if desired, or 'true' to enable
    
    if (image) {
        params.append('image', image);
    }

    const url = `${baseUrl}?${params.toString()}`;

    // 3. Fetch from Pollinations
    const imageRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*'
      }
    });

    if (!imageRes.ok) {
      let errorMessage = imageRes.statusText;
      try {
        const text = await imageRes.text();
        if (text.trim().startsWith('{')) {
            const json = JSON.parse(text);
            errorMessage = JSON.stringify(json);
        } else {
            errorMessage = `Request blocked (${imageRes.status}). content filter or invalid param.`;
        }
      } catch (e) { }

      return new Response(JSON.stringify({ error: `Pollinations API Error (${imageRes.status}): ${errorMessage}` }), { 
        status: imageRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(imageRes.body, {
      headers: {
        'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
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
