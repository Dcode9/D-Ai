export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. Safe Origin Handling
  // We cannot use '*' if we want to allow credentials (cookies/auth headers).
  // We must reflect the specific origin or default to your site's URL if missing.
  const requestOrigin = req.headers.get('origin');
  const allowedOrigin = requestOrigin || 'https://ai.dverse.fun'; 

  // 2. Robust CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true', // Required for cookies/same-origin
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  };

  // 3. Handle Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 4. Health Check (GET)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'Online' }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // 5. Main Logic (POST)
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

      // Forward response status to help debugging
      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: `Upstream Error: ${response.status}`, details: errorText }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Clone response to attach CORS headers
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
