import { Blob } from 'node:buffer';
import { promises as fs } from 'node:fs';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false
  }
};

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const form = formidable({
    maxFileSize: MAX_IMAGE_SIZE,
    multiples: false,
    keepExtensions: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return sendJson(res, status, { error: err.message || 'Failed to parse upload' });
    }

    const fileCandidate = files.file || files.image || files.upload;
    const file = Array.isArray(fileCandidate) ? fileCandidate[0] : fileCandidate;

    if (!file) {
      return sendJson(res, 400, { error: 'No file provided' });
    }

    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      if (file.filepath) await fs.unlink(file.filepath).catch(() => {});
      return sendJson(res, 400, { error: 'Only image uploads are allowed' });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      if (file.filepath) await fs.unlink(file.filepath).catch(() => {});
      return sendJson(res, 413, { error: 'Image must be under 50MB' });
    }

    try {
      const buffer = await fs.readFile(file.filepath);
      const uploadData = new FormData();
      uploadData.append('reqtype', 'fileupload');
      const blob = new Blob([buffer], { type: file.mimetype });
      uploadData.append('fileToUpload', blob, file.originalFilename || 'upload');

      const uploadRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: uploadData
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload Service Error: ${uploadRes.status}`);
      }

      const url = (await uploadRes.text()).trim();
      if (!/^https?:\/\//i.test(url)) {
        throw new Error(`Upload Service Error: ${url || 'Invalid response'}`);
      }

      return sendJson(res, 200, { success: true, link: url });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    } finally {
      if (file.filepath) {
        await fs.unlink(file.filepath).catch(() => {});
      }
    }
  });
}
