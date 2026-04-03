export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, models, image } = await req.json();
    
    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API; 

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: POLLINATIONS_API key is missing." }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalPrompt = prompt && prompt.trim() ? prompt : "abstract art";
    // Default to three models if none provided
    const modelList = models && Array.isArray(models) && models.length > 0 
      ? models 
      : ['wan-image', 'qwen-image', 'flux'];

    // Loop through models and fetch images
    const results = await Promise.all(modelList.map(async (modelName) => {
      const baseUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(finalPrompt)}`;
      const params = new URLSearchParams();
      if (width) params.append('width', width);
      if (height) params.append('height', height);
      if (seed) params.append('seed', seed);
      params.append('model', modelName);
      params.append('nologo', 'true');
      params.append('safe', 'false');
      if (image) params.append('image', image);

      const url = `${baseUrl}?${params.toString()}`;

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

        return { model: modelName, error: `Pollinations API Error (${imageRes.status}): ${errorMessage}` };
      }

      return {
        model: modelName,
        contentType: imageRes.headers.get('Content-Type') || 'image/jpeg',
        body: Buffer.from(await imageRes.arrayBuffer()).toString('base64')
      };
    }));

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
