export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { query } = await req.json();
    
    // Access the key securely on the server
    const apiKey = process.env.WEB_SEARCH_API; 

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server Error: WEB_SEARCH_API is missing." }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        api_key: apiKey, 
        query: query, 
        search_depth: "basic", 
        max_results: 5, 
        include_answer: false, 
        include_images: false 
      }) 
    });

    if (!res.ok) {
        throw new Error(`Tavily API Error: ${res.status}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
