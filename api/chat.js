export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS Handling
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'Online', env_check: !!process.env.CEREBRAS_API_KEY }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      
      if (!process.env.CEREBRAS_API_KEY) {
        return new Response('Missing CEREBRAS_API_KEY env var', { status: 500, headers: corsHeaders });
      }

      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        return new Response(err, { status: response.status, headers: corsHeaders });
      }

      // Pass the stream through directly!
      return new Response(response.body, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
}
