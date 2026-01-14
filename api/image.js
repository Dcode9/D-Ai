export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model } = await req.json();
    
    const apiKey = process.env.POLLINATIONS_API; 

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: POLLINATIONS_API is missing." }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Default to nanobanana as requested
    const finalModel = model || 'nanobanana'; 
    const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${finalModel}&nologo=true`;

    const imageRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'DAi-Server/1.0'
      }
    });

    if (!imageRes.ok) {
      // Try to parse the specific error from Pollinations (like the 429 you saw)
      let errorMessage = imageRes.statusText;
      try {
        const errorJson = await imageRes.json();
        if (errorJson.error) {
            // Handle nested error objects (like the Vertex AI 429 error)
            errorMessage = typeof errorJson.error === 'object' ? JSON.stringify(errorJson.error) : errorJson.error;
        }
      } catch (e) { /* ignore JSON parse fail */ }

      return new Response(JSON.stringify({ error: `Pollinations Error (${imageRes.status}): ${errorMessage}` }), { 
        status: imageRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(imageRes.body, {
      headers: {
        'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
