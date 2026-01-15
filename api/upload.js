export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }

    // Forward to tmpfiles.org (reliable ephemeral storage)
    const uploadData = new FormData();
    uploadData.append('file', file);

    const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: uploadData
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload Service Error: ${uploadRes.status}`);
    }

    const json = await uploadRes.json();
    
    // Convert download URL to direct image URL for the AI
    // tmpfiles returns: https://tmpfiles.org/dl/12345/image.png
    // We need: https://tmpfiles.org/12345/image.png (remove /dl/)
    const rawUrl = json.data.url;
    const directUrl = rawUrl.replace('/dl/', '/');

    return new Response(JSON.stringify({ success: true, link: directUrl }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
