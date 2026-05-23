import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false
  }
};

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const IMAGE_MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
};

const getFetchTools = async () => {
  let FormDataCtor = globalThis.FormData;
  let BlobCtor = globalThis.Blob;
  let fetchImpl = globalThis.fetch;

  if (!FormDataCtor || !BlobCtor || !fetchImpl) {
    try {
      const undici = await import('undici');
      FormDataCtor = FormDataCtor || undici.FormData;
      BlobCtor = BlobCtor || undici.Blob;
      fetchImpl = fetchImpl || undici.fetch;
    } catch (error) {
      throw new Error('Upload service misconfigured: FormData support is unavailable.');
    }
  }

  return { FormDataCtor, BlobCtor, fetchImpl };
};

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
    keepExtensions: true,
    uploadDir: os.tmpdir()
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return sendJson(res, status, { error: err.message || 'Failed to parse upload' });
    }

    const fileCandidate = files.file || files.image || files.upload || Object.values(files || {})[0];
    const file = Array.isArray(fileCandidate) ? fileCandidate[0] : fileCandidate;

    if (!file) {
      return sendJson(res, 400, { error: 'No file provided' });
    }

    const ext = path.extname(file.originalFilename || '').toLowerCase();
    const mimeFromExt = IMAGE_MIME_BY_EXT[ext];
    const resolvedMimeType = file.mimetype && file.mimetype.startsWith('image/')
      ? file.mimetype
      : mimeFromExt;

    if (!resolvedMimeType || !resolvedMimeType.startsWith('image/')) {
      if (file.filepath) await fs.unlink(file.filepath).catch(() => {});
      return sendJson(res, 400, { error: 'Only image uploads are allowed' });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      if (file.filepath) await fs.unlink(file.filepath).catch(() => {});
      return sendJson(res, 413, { error: 'Image must be under 50MB' });
    }

    try {
      const { FormDataCtor, BlobCtor, fetchImpl } = await getFetchTools();
      const buffer = await fs.readFile(file.filepath);
      const uploadData = new FormDataCtor();
      uploadData.append('reqtype', 'fileupload');
      const fallbackExt = mimeFromExt || '.jpg';
      const filename = file.originalFilename || `upload${fallbackExt}`;
      const blob = new BlobCtor([buffer], { type: resolvedMimeType });
      uploadData.append('fileToUpload', blob, filename);

      const uploadRes = await fetchImpl('https://catbox.moe/user/api.php', {
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
