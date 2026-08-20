export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function imageResponse(bytes, contentType = 'image/jpeg') {
  return new Response(bytes, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...CORS_HEADERS,
    },
  });
}

function toPositiveInt(value, fallback = 1024) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function toSeed(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function base64ToUint8Array(base64) {
  const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s+/g, '');
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ----------------------------------------------------
// Provider 1: Cloudflare Workers AI
// ----------------------------------------------------
async function generateWithCloudflare({ prompt, model = '@cf/black-forest-labs/flux-1-schnell', num_steps = 4 }) {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = (process.env.CLOUDFLARE_API_TOKEN || '').trim();

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured');
  }

  const cleanModel = model.startsWith('@cf/') ? model.trim() : `@cf/${model.trim()}`;
  
  // Strict schema: FLUX on Cloudflare accepts ONLY prompt
  let payload = { prompt: prompt.trim() };
  if (cleanModel.includes('stable-diffusion-xl-base-1.0')) {
    payload.num_steps = Math.min(Math.max(Number(num_steps) || 20, 1), 50);
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cleanModel}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Cloudflare error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    const base64 = json.result?.image || (typeof json.result === 'string' ? json.result : null) || json.image;
    if (!base64) throw new Error('Cloudflare response missing image data');
    return { bytes: base64ToUint8Array(base64), mimeType: 'image/png', provider: 'cloudflare' };
  }

  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const mimeType = contentType.split(';')[0].trim() || 'image/png';
  return { bytes, mimeType, provider: 'cloudflare' };
}

// ----------------------------------------------------
// Provider 2: Hugging Face Serverless API
// ----------------------------------------------------
async function generateWithHuggingFace({ prompt, model = 'runwayml/stable-diffusion-v1-5', seed }) {
  const token = (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '').trim();
  if (!token) {
    throw new Error('Hugging Face token not configured');
  }

  const cleanModel = model.trim();
  const endpoints = [
    `https://router.huggingface.co/models/${cleanModel}`,
    `https://router.huggingface.co/hf-inference/models/${cleanModel}`,
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'image/png, image/jpeg, image/*',
        },
        body: JSON.stringify({
          inputs: prompt.trim(),
          parameters: { seed: seed || Math.floor(Math.random() * 2147483647) }
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await res.arrayBuffer();
        return { bytes: new Uint8Array(arrayBuffer), mimeType: contentType, provider: 'huggingface' };
      }

      const errText = await res.text().catch(() => '');
      lastError = new Error(`HF error (${res.status}): ${errText.slice(0, 150)}`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Hugging Face generation failed');
}

// ----------------------------------------------------
// Provider 3: Free Fallback Engine (Pollinations FLUX / Turbo)
// ----------------------------------------------------
async function generateWithPollinations({ prompt, width, height, seed, model = 'flux', image }) {
  const apiKey = (process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API || '').trim();

  // If image editing is requested (image-to-image)
  if (image) {
    const editUrl = 'https://gen.pollinations.ai/v1/images/edits';
    const requestBody = {
      prompt,
      model: model || 'kontext',
      image: Array.isArray(image) ? image : [image],
      size: `${width}x${height}`,
      n: 1,
      response_format: 'b64_json',
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(editUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000),
    });

    if (res.ok) {
      const payload = await res.json();
      const b64 = payload.data?.[0]?.b64_json || payload.b64_json;
      if (b64) {
        return { bytes: base64ToUint8Array(b64), mimeType: 'image/png', provider: 'pollinations' };
      }
      const imgUrl = payload.data?.[0]?.url || payload.url;
      if (imgUrl) {
        const imgRes = await fetch(imgUrl);
        const arrayBuffer = await imgRes.arrayBuffer();
        return { bytes: new Uint8Array(arrayBuffer), mimeType: imgRes.headers.get('content-type') || 'image/jpeg', provider: 'pollinations' };
      }
    }
  }

  // Standard text-to-image generation
  const modelsToTry = [model || 'flux', 'turbo'];
  let lastErr = null;

  for (const m of modelsToTry) {
    try {
      const params = new URLSearchParams();
      params.append('width', String(width));
      params.append('height', String(height));
      params.append('seed', String(seed));
      params.append('model', m);
      params.append('nologo', 'true');

      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
      
      const headers = {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) D-Ai/2.0',
      };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(60000),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await res.arrayBuffer();
        return { bytes: new Uint8Array(arrayBuffer), mimeType: contentType, provider: 'pollinations' };
      } else {
        const errText = await res.text().catch(() => '');
        lastErr = new Error(`Pollinations API error (${res.status}): ${errText.slice(0, 150)}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('Pollinations image generation failed');
}

// ----------------------------------------------------
// Main Handler: Auto-Cascade Image Generator
// ----------------------------------------------------
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const { prompt, width, height, seed, image, model, provider } = body;

    const finalWidth = toPositiveInt(width, 1024);
    const finalHeight = toPositiveInt(height, 1024);
    const finalSeed = toSeed(seed, Math.floor(Math.random() * 2147483647));
    const finalPrompt = prompt && String(prompt).trim() ? String(prompt).trim() : 'masterpiece digital art';

    console.log(`[D-Ai Image] Generating: "${finalPrompt.slice(0, 60)}..." (${finalWidth}x${finalHeight})`);

    const hasCloudflare = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
    const hasHuggingFace = Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);

    // Build execution sequence
    const attempts = [];
    let imageResult = null;

    // 1. If Cloudflare is requested or available (and not an image edit), try Cloudflare
    if (!image && (provider === 'cloudflare' || (hasCloudflare && provider !== 'huggingface' && provider !== 'pollinations'))) {
      try {
        imageResult = await generateWithCloudflare({
          prompt: finalPrompt,
          model: model?.startsWith('@cf/') ? model : '@cf/black-forest-labs/flux-1-schnell',
        });
      } catch (err) {
        console.warn('[D-Ai Image] Cloudflare attempt failed:', err.message);
        attempts.push({ provider: 'cloudflare', error: err.message });
      }
    }

    // 2. If Hugging Face is requested or available, try Hugging Face
    if (!imageResult && !image && (provider === 'huggingface' || (hasHuggingFace && provider !== 'cloudflare' && provider !== 'pollinations'))) {
      try {
        imageResult = await generateWithHuggingFace({
          prompt: finalPrompt,
          model: model || 'runwayml/stable-diffusion-v1-5',
          seed: finalSeed,
        });
      } catch (err) {
        console.warn('[D-Ai Image] Hugging Face attempt failed:', err.message);
        attempts.push({ provider: 'huggingface', error: err.message });
      }
    }

    // 3. Fallback to Free High-Definition Engine (Pollinations FLUX / Turbo)
    if (!imageResult) {
      try {
        imageResult = await generateWithPollinations({
          prompt: finalPrompt,
          width: finalWidth,
          height: finalHeight,
          seed: finalSeed,
          model: model || (image ? 'kontext' : 'flux'),
          image,
        });
      } catch (err) {
        console.error('[D-Ai Image] Pollinations attempt failed:', err.message);
        attempts.push({ provider: 'pollinations', error: err.message });
      }
    }

    if (!imageResult || !imageResult.bytes) {
      const allErrors = attempts.map(a => `${a.provider}: ${a.error}`).join(' | ');
      return jsonResponse({ error: `Image generation failed across all providers: ${allErrors}` }, 500);
    }

    console.log(`[D-Ai Image] Successfully generated via ${imageResult.provider}! Size: ${imageResult.bytes.length} bytes`);
    return imageResponse(imageResult.bytes, imageResult.mimeType);

  } catch (error) {
    console.error('[D-Ai Image] Top-level handler error:', error);
    return jsonResponse({ error: error.message || 'Internal Server Error' }, 500);
  }
}
