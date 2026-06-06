export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function inferSearchOptions(query) {
  const normalized = query.toLowerCase();
  const wantsNews = /\b(news|latest|today|tonight|yesterday|breaking|recent|recently|live|real[-\s]?time|update|updated|score|schedule)\b/.test(normalized);
  const wantsFreshness = /\b(latest|today|tonight|yesterday|recent|recently|current|now|live|real[-\s]?time|update|updated)\b/.test(normalized);

  return {
    topic: wantsNews ? 'news' : 'general',
    ...(wantsFreshness ? { time_range: 'month' } : {})
  };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return jsonResponse({ error: 'Search query is required.' }, 400);
    }

    const apiKey = process.env.WEB_SEARCH_API || process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return jsonResponse({ error: 'Server Error: WEB_SEARCH_API or TAVILY_API_KEY is missing.' }, 500);
    }

    const searchOptions = inferSearchOptions(query);
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query,
        search_depth: body.search_depth || 'basic',
        max_results: Math.min(Math.max(Number(body.max_results) || 5, 1), 10),
        include_answer: 'basic',
        include_images: false,
        include_favicon: true,
        safe_search: true,
        ...searchOptions
      })
    });

    if (!tavilyRes.ok) {
      const detail = await tavilyRes.text().catch(() => tavilyRes.statusText);
      return jsonResponse({ error: `Tavily API Error (${tavilyRes.status}): ${detail || tavilyRes.statusText}` }, tavilyRes.status);
    }

    const data = await tavilyRes.json();
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
