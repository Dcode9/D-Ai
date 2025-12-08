export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // SYSTEMATIC FIX: Public API Configuration
  // 1. Allow '*' Origin (Simplest, least error-prone)
  // 2. Do NOT allow Credentials (Cookies). This prevents 403s from strict security settings.
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health Check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'Online' }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Main Logic
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
