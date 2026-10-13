export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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
  const cleanBase64 = String(base64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s+/g, '');
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
async function generateWithCloudflare({ prompt, accountId, apiToken, model = '@cf/black-forest-labs/flux-1-schnell', num_steps = 4 }) {
  const cfAccount = (accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cfToken = (apiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();

  if (!cfAccount || !cfToken) {
    throw new Error('Cloudflare credentials not provided');
  }

  const cleanModel = model.startsWith('@cf/') ? model.trim() : `@cf/${model.trim()}`;
  
  // Strict schema: FLUX on Cloudflare accepts ONLY prompt
  let payload = { prompt: prompt.trim() };
  if (cleanModel.includes('stable-diffusion-xl-base-1.0')) {
    payload.num_steps = Math.min(Math.max(Number(num_steps) || 20, 1), 50);
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/${cleanModel}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfToken}`,
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
async function generateWithHuggingFace({ prompt, token, model = 'runwayml/stable-diffusion-v1-5', seed }) {
  const hfToken = (token || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '').trim();
  if (!hfToken) {
    throw new Error('Hugging Face token not provided');
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
          'Authorization': `Bearer ${hfToken}`,
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
// Provider 3: Free High-Definition Engine (Pollinations FLUX / Turbo)
// ----------------------------------------------------
async function generateWithPollinations({ prompt, width, height, seed, model = 'flux', image }) {
  // If image editing is requested (image-to-image)
  if (image) {
    try {
      const editUrl = 'https://gen.pollinations.ai/v1/images/edits';
      const requestBody = {
        prompt,
        model: model || 'kontext',
        image: Array.isArray(image) ? image : [image],
        size: `${width}x${height}`,
        n: 1,
        response_format: 'b64_json',
      };

      const res = await fetch(editUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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
    } catch (e) {
      console.warn('[D-Ai Image] Image edit endpoint error:', e.message);
    }
  }

  // Standard text-to-image generation with ZERO token requirement (avoids 402 payment errors)
  const modelsToTry = [model === 'flux' || model === 'turbo' ? model : 'flux', 'turbo'];
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
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) D-Ai/2.0',
        },
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

  throw lastErr || new Error('Free engine image generation failed');
}

// ----------------------------------------------------
// Provider 0: Pollinations paid gateway (Pollen balance, key stays server-side)
// Default z-image-turbo (0.004 Pollen), edits klein (0.005), fallback flux schnell (0.002)
// ----------------------------------------------------
const POLLEN_MODELS = {
  default: 'z-image-turbo',
  edit: 'klein',
  budget: 'flux',
  hd: 'gpt-image-2',
};
const POLLEN_ALLOWED = new Set(['z-image-turbo', 'z-image', 'klein', 'flux', 'gpt-image-2']);

function aspectToSize(aspect, width, height) {
  const map = { '1:1': [1024, 1024], '16:9': [1280, 720], '9:16': [720, 1280], '4:3': [1152, 864], '3:4': [864, 1152], '3:2': [1216, 832], '2:3': [832, 1216] };
  if (aspect && map[aspect]) return map[aspect];
  return [width, height];
}

async function generateWithPollinationsPaid({ prompt, width, height, seed, model, image, key }) {
  const chain = image
    ? [POLLEN_MODELS.edit]
    : model === POLLEN_MODELS.hd
      ? [POLLEN_MODELS.hd, POLLEN_MODELS.default, POLLEN_MODELS.budget]
      : [POLLEN_ALLOWED.has(model) ? model : POLLEN_MODELS.default, POLLEN_MODELS.budget];
  let lastErr = null;
  for (const m of chain) {
    try {
      const res = await fetch(
        image ? 'https://gen.pollinations.ai/v1/images/edits' : 'https://gen.pollinations.ai/v1/images/generations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            prompt,
            model: m,
            size: `${width}x${height}`,
            n: 1,
            seed,
            response_format: 'b64_json',
            ...(image ? { image: Array.isArray(image) ? image : [image] } : {}),
          }),
          signal: AbortSignal.timeout(m === POLLEN_MODELS.hd ? 110000 : 45000),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        lastErr = new Error(`Pollinations ${m} (${res.status}): ${t.slice(0, 120)}`);
        continue;
      }
      const payload = await res.json();
      const b64 = payload.data?.[0]?.b64_json;
      if (b64) {
        const bytes = base64ToUint8Array(b64);
        const mimeType = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0x52 ? 'image/webp' : 'image/jpeg';
        return { bytes, mimeType, provider: `pollen:${m}` };
      }
      const u = payload.data?.[0]?.url;
      if (u) {
        const r = await fetch(u);
        return { bytes: new Uint8Array(await r.arrayBuffer()), mimeType: r.headers.get('content-type') || 'image/jpeg', provider: `pollen:${m}` };
      }
      lastErr = new Error(`Pollinations ${m}: empty response`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Pollinations paid generation failed');
}

// ----------------------------------------------------
// Main Handler: Auto-Cascade Image Generator
// ----------------------------------------------------
async function innerHandler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const { 
      prompt, 
      width, 
      height, 
      seed, 
      image, 
      model, 
      provider,
      cfAccountId,
      cfApiToken,
      hfToken,
      cfModel,
      hfModel,
      aspect_ratio
    } = body;

    const [aw, ah] = aspectToSize(aspect_ratio, toPositiveInt(width, 1024), toPositiveInt(height, 1024));
    const finalWidth = aw;
    const finalHeight = ah;
    const finalSeed = toSeed(seed, Math.floor(Math.random() * 2147483647));
    let finalPrompt = prompt && String(prompt).trim() ? String(prompt).trim() : 'masterpiece digital art';
    // Safety net: if a very short prompt reaches us (not already expanded by the chat model), add quality cues. No extra latency.
    if (!image && finalPrompt.split(/\s+/).length < 14) {
      finalPrompt += ', highly detailed, sharp focus, rich colours, professional composition, cinematic natural lighting';
    }

    const accountId = (cfAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
    const apiToken = (cfApiToken || process.env.CLOUDFLARE_API_TOKEN || '').trim();
    const token = (hfToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '').trim();

    const hasCloudflare = Boolean(accountId && apiToken);
    const hasHuggingFace = Boolean(token);

    console.log(`[D-Ai Image] Generating: "${finalPrompt.slice(0, 60)}..." (${finalWidth}x${finalHeight}) [CF: ${hasCloudflare}, HF: ${hasHuggingFace}]`);

    const attempts = [];
    let imageResult = null;

    // 0. Pollinations paid gateway (Pollen) when a server-side key is configured
    const pollenKey = (process.env.POLLINATIONS_API_KEY || '').trim();
    if (pollenKey && !['cloudflare', 'huggingface'].includes(provider)) {
      try {
        imageResult = await generateWithPollinationsPaid({
          prompt: finalPrompt, width: finalWidth, height: finalHeight, seed: finalSeed, model, image, key: pollenKey,
        });
      } catch (err) {
        console.warn('[D-Ai Image] Pollen gateway failed:', err.message);
        attempts.push({ provider: 'pollen', error: err.message });
      }
    }

    // 1. Try Cloudflare Workers AI if configured or requested
    if (!imageResult && !image && (provider === 'cloudflare' || (hasCloudflare && provider !== 'huggingface' && provider !== 'pollinations'))) {
      try {
        imageResult = await generateWithCloudflare({
          prompt: finalPrompt,
          accountId,
          apiToken,
          model: cfModel || model || '@cf/black-forest-labs/flux-1-schnell',
        });
      } catch (err) {
        console.warn('[D-Ai Image] Cloudflare attempt failed:', err.message);
        attempts.push({ provider: 'cloudflare', error: err.message });
      }
    }

    // 2. Try Hugging Face if configured or requested
    if (!imageResult && !image && (provider === 'huggingface' || (hasHuggingFace && provider !== 'cloudflare' && provider !== 'pollinations'))) {
      try {
        imageResult = await generateWithHuggingFace({
          prompt: finalPrompt,
          token,
          model: hfModel || model || 'runwayml/stable-diffusion-v1-5',
          seed: finalSeed,
        });
      } catch (err) {
        console.warn('[D-Ai Image] Hugging Face attempt failed:', err.message);
        attempts.push({ provider: 'huggingface', error: err.message });
      }
    }

    // 3. Fallback to Free Engine (Zero-Key, zero-balance required)
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
        console.error('[D-Ai Image] Free engine attempt failed:', err.message);
        attempts.push({ provider: 'free-fallback', error: err.message });
      }
    }

    if (!imageResult || !imageResult.bytes) {
      const allErrors = attempts.map(a => `${a.provider}: ${a.error}`).join(' | ');
      return jsonResponse({ error: `Image generation failed: ${allErrors}` }, 500);
    }

    console.log(`[D-Ai Image] Generated successfully via ${imageResult.provider}! Size: ${imageResult.bytes.length} bytes`);
    const ir = imageResponse(imageResult.bytes, imageResult.mimeType);
    ir.headers.set('x-provider', String(imageResult.provider || ''));
    return ir;

  } catch (error) {
    console.error('[D-Ai Image Critical Error]', error);
    return jsonResponse({ error: error.message || 'Internal Server Error' }, 500);
  }
}

function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

// HD (gpt-image-2) takes longer than the edge 25s first-byte limit, so stream
// keep-alive whitespace and finish with JSON. Internal callers send x-sync.
export default async function handler(req) {
  if (req.method !== 'POST' || req.headers.get('x-sync')) return innerHandler(req);
  let peek = {};
  try { peek = await req.clone().json(); } catch {}
  if (peek.model !== 'gpt-image-2') return innerHandler(req);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const beat = setInterval(() => { try { controller.enqueue(enc.encode(' ')); } catch {} }, 5000);
      controller.enqueue(enc.encode(' '));
      try {
        const r = await innerHandler(req);
        const ct = r.headers.get('content-type') || '';
        if (r.ok && ct.startsWith('image/')) {
          const bytes = new Uint8Array(await r.arrayBuffer());
          controller.enqueue(enc.encode(JSON.stringify({ image: `data:${ct.split(';')[0]};base64,${bytesToBase64(bytes)}`, provider: r.headers.get('x-provider') || '' })));
        } else {
          controller.enqueue(enc.encode(await r.text()));
        }
      } catch (e) {
        controller.enqueue(enc.encode(JSON.stringify({ error: String(e?.message || e) })));
      }
      clearInterval(beat);
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS } });
}
