export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. Get the request origin (e.g., https://ai.dverse.fun)
  // Fallback to * if null (e.g. non-browser requests), but prefer explicit for browsers
  const origin = req.headers.get('origin') || '*';

  // 2. robust CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true', // Critical for "same-origin" credential mode
  };

  // 3. Handle Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 4. Health Check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'Online' }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // 5. Main Logic
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      
      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      // Clone and attach CORS headers to the response
      const newResponse = new Response(response.body, response);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
      });
      
      return newResponse;

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
