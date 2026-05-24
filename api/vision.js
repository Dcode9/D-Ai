export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { imageUrl, prompt = "Describe this image in detail." } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing imageUrl" }), { status: 400, headers: CORS_HEADERS });
    }

    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    const payload = {
      model: "openai",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }]
    };

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    };

    if (apiKey) {
      fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', fetchOptions);

    if (!res.ok) {
      const errorText = await res.text();
      return new Response(JSON.stringify({ error: `Pollinations Vision API Error (${res.status}): ${errorText}` }), { status: res.status, headers: CORS_HEADERS });
    }

    const data = await res.json();
    const description = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ description }), {
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}
