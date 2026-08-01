import { INTERFACE_CODE_SYSTEM_PROMPT } from './prompts/interfaceCoding.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function detectType(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (/pythagor|right triangle|hypotenuse/.test(text)) return 'pythagoras';
  if (/demo|interactive|simulate|calculator|sandbox|html|css|javascript|js\b|diagram|draw|geometry|vector|function|parabola|slope|derivative|integral|calculus/.test(text)) return 'demo';
  return 'chart';
}

function extractFence(content) {
  const text = String(content || '').trim();
  const match = text.match(/```dai-ui\s+(chart|graph|demo|sandbox|pythagoras)\s*\n([\s\S]*?)```/i);
  if (match) return `Here’s the interactive version:\n\n\`\`\`dai-ui ${match[1].toLowerCase()}\n${match[2].trim()}\n\`\`\``;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

function normalizeContent(content, type) {
  const extracted = extractFence(content);
  if (extracted.includes('```dai-ui')) return extracted;
  try {
    JSON.parse(extracted);
    return `Here’s the interactive version:\n\n\`\`\`dai-ui ${type}\n${extracted}\n\`\`\``;
  } catch (e) {
    return extracted || 'I could not build that interactive view.';
  }
}

async function callCerebras({ apiKey, prompt, type }) {
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'zai-glm-4.7',
      stream: false,
      temperature: 0.8,
      top_p: 0.95,
      max_completion_tokens: 12000,
      clear_thinking: false,
      messages: [
        { role: 'system', content: `${INTERFACE_CODE_SYSTEM_PROMPT}\nRequested widget type: ${type}` },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`zai-glm-4.7 failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const message = payload.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map((part) => part?.text || '').join('\n');
  return '';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const { prompt, type: requestedType } = await req.json();
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) return json({ error: 'Configuration Error: CEREBRAS_API_KEY is missing.' }, 401);

    const type = requestedType || detectType(prompt);
    const content = await callCerebras({ apiKey, prompt, type });
    return json({ content: normalizeContent(content, type), type });
  } catch (error) {
    return json({ error: error.message || 'Interface generation failed.' }, 500);
  }
}

export const config = {
  runtime: 'edge'
};
