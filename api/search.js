export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
});

// Conservative HTML tag/attr stripper — only the bits we want to keep
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// Validate URL before using it
const safeUrl = (rawUrl) => {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch (e) { return null; }
};

async function searchTavily(query, apiKey) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: 8,
      include_answer: true,
      include_images: false
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return {
    answer: data.answer || null,
    results: (data.results || []).map((r) => ({
      title: String(r.title || '').slice(0, 200),
      url: safeUrl(r.url) || '',
      content: String(r.content || r.snippet || '').slice(0, 600)
    })).filter((r) => r.url)
  };
}

async function searchDDG(query) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!res.ok) return [];
  const html = await res.text();

  // Try to grab results with multiple selectors — DDG markup changes often
  const rows = [];
  // Newer layout: <a class="result__a" ...>title</a> + <a class="result__snippet" ...>snippet</a>
  const titleRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const titles = [];
  let m;
  while ((m = titleRe.exec(html)) !== null && titles.length < 6) {
    const url = safeUrl(m[1].replace(/&amp;/g, '&'));
    if (url) titles.push({ title: stripHtml(m[2]).slice(0, 120), url });
  }

  const snippets = [];
  while ((m = snippetRe.exec(html)) !== null && snippets.length < 6) {
    snippets.push(stripHtml(m[1]));
  }

  for (let i = 0; i < Math.min(titles.length, snippets.length); i++) {
    rows.push({
      title: titles[i].title || snippets[i].slice(0, 50) + '...',
      url: titles[i].url,
      content: snippets[i]
    });
  }
  // Fallback: parse snippet-only rows from the older layout
  if (rows.length === 0) {
    const fallbackRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let fm;
    while ((fm = fallbackRe.exec(html)) !== null && rows.length < 6) {
      const snippet = stripHtml(fm[1]);
      if (snippet) {
        rows.push({
          title: snippet.slice(0, 50) + '...',
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          content: snippet
        });
      }
    }
  }
  return rows;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    let body;
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON body' }, 400); }

    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 500) : '';
    if (!query) return json({ error: 'Query parameter is required' }, 400);

    const apiKey = (process.env.WEB_SEARCH_API || '').trim();
    let results = [];
    let answer = null;

    if (apiKey) {
      try {
        const tavilyResult = await searchTavily(query, apiKey);
        answer = tavilyResult.answer;
        results = tavilyResult.results;
      } catch (err) {
        console.warn('[D-Ai search] Tavily warning:', err.message);
      }
    }

    // DDG fallback if Tavily unavailable or returns 0 results
    if (!results.length) {
      try {
        results = await searchDDG(query);
      } catch (e) {
        console.warn('[D-Ai search] DDG fallback warning:', e.message);
      }
    }

    return json({ query, answer, results, count: results.length });
  } catch (error) {
    return json({ error: 'Search failed', detail: error.message }, 500);
  }
}
