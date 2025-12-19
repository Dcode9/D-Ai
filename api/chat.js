// This file runs on the server (Vercel).
// It securely uses the TAVILY_API_KEY from your Environment Variables.

export const config = {
  runtime: 'edge', // Fast startup
};

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'false',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
};

export default async function handler(req) {
  // Handle CORS pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const { query } = await req.json();
    
    // Get the key from Vercel Environment Variables
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server Error: TAVILY_API_KEY not configured" }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Call Tavily API
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic", // "basic" is faster than "advanced"
        max_results: 5,
        include_answer: false,
        include_images: false
      })
    });

    if (!response.ok) {
        throw new Error(`Tavily API Error: ${response.status}`);
    }

    const data = await response.json();

    // Return the results to the client
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}
