export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*'
};

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function imageResponse(stream, contentType) {
  return new Response(stream, {
    headers: {
      'Content-Type': contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...CORS_HEADERS
    }
  });
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toSeed(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function decodeBase64Image(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null;
  }

  const trimmed = rawValue.trim();
  let mimeType = 'image/png';
  let base64Payload = trimmed;

  const dataUrlMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    base64Payload = dataUrlMatch[2];
  }

  try {
    const binary = atob(base64Payload.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, mimeType };
  } catch (e) {
    return null;
  }
}

function extractImageData(payload) {
  const firstDataItem = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;

  const urlCandidates = [
    payload?.url,
    payload?.image,
    payload?.result?.url,
    payload?.output?.url,
    payload?.output?.[0]?.url,
    payload?.images?.[0]?.url,
    firstDataItem?.url,
    firstDataItem?.image,
  ];

  const imageUrl = urlCandidates.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value));

  const base64Candidates = [
    firstDataItem?.b64_json,
    payload?.b64_json,
    payload?.image_base64,
    payload?.result?.b64_json,
    payload?.output?.[0]?.b64_json,
  ];

  let decodedBase64 = null;
  for (const candidate of base64Candidates) {
    decodedBase64 = decodeBase64Image(candidate);
    if (decodedBase64) {
      break;
    }
  }

  return {
    imageUrl,
    decodedBase64,
    debug: {
      topLevelKeys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 20) : [],
      firstDataKeys: firstDataItem && typeof firstDataItem === 'object' ? Object.keys(firstDataItem).slice(0, 20) : []
    }
  };
}

function selectModel(requestedModel, hasSourceImage) {
  const normalized = (requestedModel || '').trim().toLowerCase();

  if (!hasSourceImage) {
    return requestedModel || 'zimage';
  }

  // Models like flux/zimage are text-to-image focused and may ignore edit references.
  if (!normalized || normalized === 'flux' || normalized === 'zimage') {
    return 'gptimage-large';
  }

  return requestedModel;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model, image } = await req.json();

    const finalWidth = toPositiveInt(width, 1024);
    const finalHeight = toPositiveInt(height, 1024);
    const finalSeed = toSeed(seed, 0);

    console.log('[API /api/image] Received request:', {
      prompt,
      width: finalWidth,
      height: finalHeight,
      seed: finalSeed,
      model,
      hasImage: !!image,
      imageUrl: image
    });

    const apiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;

    if (!apiKey) {
      return jsonResponse({ error: 'Configuration Error: POLLINATIONS_API key is missing.' }, 401);
    }

    const finalPrompt = prompt && prompt.trim() ? prompt : 'abstract art';
    const finalModel = selectModel(model, !!image);

    let url, fetchOptions;

    // Use different endpoints based on whether we're editing an image or generating new
    if (image) {
      // IMAGE EDITING: Use OpenAI-compatible /v1/images/edits endpoint
      url = 'https://gen.pollinations.ai/v1/images/edits';

      const requestBody = {
        prompt: finalPrompt,
        model: finalModel,
        image: Array.isArray(image) ? image : [image],
        size: `${finalWidth}x${finalHeight}`,
        n: 1,
        response_format: 'b64_json'
      };

      console.log('[API /api/image] Using /v1/images/edits endpoint with body:', requestBody);

      fetchOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };
    } else {
      // IMAGE GENERATION: Use simple /image/{prompt} endpoint
      const baseUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(finalPrompt)}`;

      const params = new URLSearchParams();
      params.append('width', finalWidth);
      params.append('height', finalHeight);
      params.append('seed', finalSeed);
      params.append('model', finalModel);
      params.append('nologo', 'true');
      params.append('safe', 'false');

      url = `${baseUrl}?${params.toString()}`;

      console.log('[API /api/image] Using /image endpoint:', url);

      fetchOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'image/*'
        }
      };
    }

    // Fetch from Pollinations
    const imageRes = await fetch(url, fetchOptions);

    if (!imageRes.ok) {
      let errorMessage = imageRes.statusText;
      try {
        const text = await imageRes.text();
        if (text.trim().startsWith('{')) {
            const json = JSON.parse(text);
            errorMessage = JSON.stringify(json);
        } else {
            errorMessage = `Request blocked (${imageRes.status}). content filter or invalid param.`;
        }
      } catch (e) { }

      return jsonResponse({ error: `Pollinations API Error (${imageRes.status}): ${errorMessage}` }, imageRes.status);
    }

    const responseType = imageRes.headers.get('Content-Type') || '';

    if (responseType.startsWith('image/')) {
      return imageResponse(imageRes.body, responseType);
    }

    if (responseType.includes('application/json')) {
      const payload = await imageRes.json();

      if (payload?.success === false && payload?.error) {
        const errorMessage = typeof payload.error === 'string'
          ? payload.error
          : payload.error.message || JSON.stringify(payload.error);
        return jsonResponse({ error: `Pollinations API JSON Error: ${errorMessage}` }, 502);
      }

      const extracted = extractImageData(payload);

      if (extracted.imageUrl) {
        const resolvedImageRes = await fetch(extracted.imageUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'image/*'
          }
        });

        if (resolvedImageRes.ok) {
          return imageResponse(resolvedImageRes.body, resolvedImageRes.headers.get('Content-Type') || 'image/jpeg');
        }

        return jsonResponse({ error: `Failed to resolve generated image URL (${resolvedImageRes.status}).` }, resolvedImageRes.status);
      }

      if (extracted.decodedBase64) {
        return imageResponse(extracted.decodedBase64.bytes, extracted.decodedBase64.mimeType);
      }

      // Fallback path for edit requests: use /image endpoint with reference image parameter.
      if (image) {
        const fallbackBaseUrl = `https://gen.pollinations.ai/image/${encodeURIComponent(finalPrompt)}`;
        const fallbackParams = new URLSearchParams();
        fallbackParams.append('width', finalWidth);
        fallbackParams.append('height', finalHeight);
        fallbackParams.append('seed', finalSeed);
        fallbackParams.append('model', finalModel);
        fallbackParams.append('nologo', 'true');
        fallbackParams.append('safe', 'false');
        fallbackParams.append('image', image);

        const fallbackUrl = `${fallbackBaseUrl}?${fallbackParams.toString()}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'image/*'
          }
        });

        if (fallbackRes.ok) {
          return imageResponse(fallbackRes.body, fallbackRes.headers.get('Content-Type') || 'image/jpeg');
        }

        let fallbackDetail = fallbackRes.statusText;
        try {
          const fallbackText = await fallbackRes.text();
          if (fallbackText.trim().startsWith('{')) {
            fallbackDetail = JSON.stringify(JSON.parse(fallbackText));
          }
        } catch (e) { }

        return jsonResponse({
          error: `Image edit fallback failed (${fallbackRes.status}): ${fallbackDetail}`,
          debug: extracted.debug
        }, 502);
      }

      return jsonResponse({
        error: 'Pollinations API returned JSON without image URL or b64 data.',
        debug: extracted.debug
      }, 502);
    }

    // If content type is missing or unknown, pass through as image to keep compatibility.
    return imageResponse(imageRes.body, imageRes.headers.get('Content-Type') || 'image/jpeg');

  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
