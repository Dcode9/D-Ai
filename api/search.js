export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query parameter is required" }), { status: 400 });
    }

    const apiKey = process.env.WEB_SEARCH_API; 
    let results = [];
    let answer = null;

    if (apiKey) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            api_key: apiKey, 
            query: query, 
            search_depth: "advanced", 
            max_results: 8, 
            include_answer: true, 
            include_images: false 
          }) 
        });

        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length) {
            results = data.results.map(r => ({
              title: r.title,
              url: r.url,
              content: r.content || r.snippet || ''
            }));
            answer = data.answer || null;
          }
        }
      } catch (err) {
        console.warn('Tavily search warning:', err.message);
      }
    }

    // DuckDuckGo Fallback if Tavily is unavailable or returns 0 results
    if (!results.length) {
      try {
        const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (ddgRes.ok) {
          const html = await ddgRes.text();
          const regex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
          let m;
          while ((m = regex.exec(html)) !== null && results.length < 6) {
            const snippet = m[1].replace(/<[^>]+>/g, '').trim();
            if (snippet) {
              results.push({
                title: snippet.slice(0, 50) + '...',
                url: 'https://duckduckgo.com/?q=' + encodeURIComponent(query),
                content: snippet
              });
            }
          }
        }
      } catch (e) {
        console.warn('DDG fallback search warning:', e.message);
      }
    }

    return new Response(JSON.stringify({
      query,
      answer,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
