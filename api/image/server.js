export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model } = await req.json();
    
    // 1. Access the Key Securely on the Server
    const apiKey = process.env.POLLINATIONS_API; 

    // 2. Construct the URL
    const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=${model || 'nanobanana'}&nologo=true`;

    // 3. Fetch from Pollinations with the Auth Header
    const imageRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'DAi-Proxy/1.0' // Good practice
      }
    });

    if (!imageRes.ok) {
      return new Response(`Pollinations Error: ${imageRes.statusText}`, { status: imageRes.status });
    }

    // 4. Send the image binary back to the frontend
    return new Response(imageRes.body, {
      headers: {
        'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
