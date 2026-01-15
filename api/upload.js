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

    // Switch to Catbox.moe for reliable, direct hotlinking support
    const uploadData = new FormData();
    uploadData.append('reqtype', 'fileupload');
    uploadData.append('fileToUpload', file);

    const uploadRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: uploadData
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload Service Error: ${uploadRes.status}`);
    }

    const url = await uploadRes.text();
    
    // Catbox returns the raw URL string directly
    return new Response(JSON.stringify({ success: true, link: url.trim() }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
