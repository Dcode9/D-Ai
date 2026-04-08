export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model, image } = await req.json();

    console.log('[API /api/image] Received request:', { prompt, width, height, seed, model, hasImage: !!image, imageUrl: image });

    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: POLLINATIONS_API key is missing." }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalPrompt = prompt && prompt.trim() ? prompt : "abstract art";
    const finalModel = model || 'qwen-image';

    let url, fetchOptions;

    // Use different endpoints based on whether we're editing an image or generating new
    if (image) {
      // IMAGE EDITING: Use OpenAI-compatible /v1/images/edits endpoint
      url = 'https://gen.pollinations.ai/v1/images/edits';

      const requestBody = {
        image: image,
        prompt: finalPrompt,
        model: finalModel,
        width: width,
        height: height,
        seed: seed,
        nologo: true
      };

      console.log('[API /api/image] Using /v1/images/edits endpoint with body:', requestBody);

      fetchOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'image/*'
        },
        body: JSON.stringify(requestBody)
      };
    } else {
      // IMAGE GENERATION: Use simple /image/{prompt} endpoint
      const baseUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(finalPrompt)}`;

      const params = new URLSearchParams();
      params.append('width', width);
      params.append('height', height);
      params.append('seed', seed);
      params.append('model', finalModel);
      params.append('nologo', 'true');
      params.append('safe', 'false');

      url = `${baseUrl}?${params.toString()}`;

      console.log('[API /api/image] Using /image endpoint:', url);

      fetchOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'image/*'
        }
      };
    }

    // 3. Fetch from Pollinations
    const imageRes = await fetch(url, fetchOptions);

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
