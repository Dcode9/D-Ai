export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405 });
  }

  try {
    const { messages } = await req.json();

    if (!process.env.CEREBRAS_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API Key on Server" }), { status: 500 });
    }

    // 2. Call Cerebras (Force Non-Streaming for Stability First)
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-oss-120b",
        messages: messages,
        stream: false, // Force false to debug "disappearing" text
        max_completion_tokens: 4096,
        temperature: 0.7
      }),
    });

    const data = await response.json();

    // 3. Return Data with CORS
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
