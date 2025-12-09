export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 2. Handle Options (Preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Health Check
  if (req.method === 'GET') {
    res.status(200).json({ status: 'Online' });
    return;
  }

  // 4. API Call
  if (req.method === 'POST') {
    try {
      if (!process.env.CEREBRAS_API_KEY) {
        throw new Error('Missing Server API Key');
      }

      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cerebras Error: ${errText}`);
      }

      // Stream the response back
      const data = await response.json();
      res.status(200).json(data);
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
