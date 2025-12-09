// Standard Node.js Serverless Function (Bypasses some Edge WAF rules)
export default async function handler(req, res) {
  // 1. Set Robust CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Health Check
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      env_check: !!process.env.CEREBRAS_API_KEY 
    });
  }

  // 4. Main Logic
  if (req.method === 'POST') {
    try {
      if (!process.env.CEREBRAS_API_KEY) {
        return res.status(500).json({ error: 'Missing CEREBRAS_API_KEY env var' });
      }

      // Call Cerebras
      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }

      // Stream the response back
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });

      const reader = response.body.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value); // Write chunks directly
        }
      } catch (streamError) {
        console.error('Stream Error:', streamError);
      } finally {
        res.end();
      }

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
