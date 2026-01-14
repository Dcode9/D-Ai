export const config = {
  runtime: 'edge', // Runs efficiently on Vercel Edge Network
};

export default async function handler(req) {
  // 1. Validate Request Method
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model } = await req.json();
    
    // 2. Securely Access API Key (Server-Side Only)
    const apiKey = process.env.POLLINATIONS_API; 

    // Guard: Check if key exists
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server Error: POLLINATIONS_API environment variable is not set." }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Construct URL
    const finalModel = model || 'nanobanana'; 
    const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${finalModel}&nologo=true`;

    // 4. Fetch Image from Pollinations with Auth Header
    const imageRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'DAi-Server/1.0'
      }
    });

    if (!imageRes.ok) {
      const errText = await imageRes.text();
      return new Response(JSON.stringify({ error: `Pollinations API Error (${imageRes.status}): ${errText}` }), { 
        status: imageRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Proxy the Image Blob back to Frontend
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
