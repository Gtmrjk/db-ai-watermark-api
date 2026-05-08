import express from 'express';
import multer from 'multer';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWatermarkedJpg, normalizeLanguage } from './watermark-agent.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const uploadDir = path.join(os.tmpdir(), 'db-ai-watermark-api-uploads');

await mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024),
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are supported.'));
      return;
    }

    cb(null, true);
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/watermark', upload.single('image'), async (req, res, next) => {
  const uploadedFile = req.file;

  try {
    if (!uploadedFile) {
      res.status(400).json({ error: 'Upload an image file using the multipart field name "image".' });
      return;
    }

    const language = normalizeLanguage(req.body.language || 'English');
    const result = await createWatermarkedJpg({
      imagePath: uploadedFile.path,
      language
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(result.filename)}"`);
    res.send(result.buffer);
  } catch (error) {
    next(error);
  } finally {
    if (uploadedFile?.path) {
      await rm(uploadedFile.path, { force: true });
    }
  }
});

app.use((error, _req, res, _next) => {
  const status = error.message?.includes('Unsupported language') || error.message?.includes('Only image')
    ? 400
    : 500;

  res.status(status).json({
    error: error.message || 'Unexpected error while generating the watermarked image.'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`DB A.I. Watermark API listening on port ${port}`);
});

function sanitizeFilename(filename) {
  return String(filename || 'watermarked.jpg').replace(/[^a-z0-9._-]/gi, '_');
}
