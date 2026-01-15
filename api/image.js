export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model, image } = await req.json();
    
    const apiKey = process.env.POLLINATIONS_API; 

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: POLLINATIONS_API is missing." }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalModel = model || 'nanobanana'; 
    let url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${finalModel}&nologo=true`;
    
    // Append Source Image for Editing (Img2Img) if provided
    if (image) {
        url += `&image=${encodeURIComponent(image)}`;
    }

    const imageRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'DAi-Server/1.0'
      }
    });

    if (!imageRes.ok) {
      let errorMessage = imageRes.statusText;
      try {
        const errorJson = await imageRes.json();
        if (errorJson.error) {
            errorMessage = typeof errorJson.error === 'object' ? JSON.stringify(errorJson.error) : errorJson.error;
        }
      } catch (e) { }

      return new Response(JSON.stringify({ error: `Pollinations Error (${imageRes.status}): ${errorMessage}` }), { 
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
