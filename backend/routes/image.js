const express = require('express');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
const sharp = require('sharp');
const config = require('../config/env');
const { imageUpload, assertFilesAreGenuine } = require('../middleware/upload');
const { requireAuth } = require('../middleware/auth');
const { HttpError, sanitizeFilename, stripExtension, contentDisposition } = require('../lib/validate');
const Activity = require('../models/Activity');
const db = require('../config/db');

const router = express.Router();

const compressLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many compression requests. Please wait a moment and try again.' },
});

const FORMAT_MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const FORMAT_EXT = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const VALID_FORMATS = ['original', 'jpeg', 'png', 'webp'];

/* ------------------------------------------------------------------ *
 * Settings parsing — every value is clamped server-side. The client is
 * never trusted, and a hostile value can never ask for a huge image.
 * ------------------------------------------------------------------ */

function parseSettings(body = {}) {
  const errors = {};
  const settings = {};

  // Quality: 10–100
  const quality = Number(body.quality);
  if (!Number.isFinite(quality)) settings.quality = 80;
  else if (quality < 10 || quality > 100) errors.quality = 'Quality must be between 10 and 100.';
  else settings.quality = Math.round(quality);

  // Format
  const format = String(body.format || 'original').toLowerCase();
  if (!VALID_FORMATS.includes(format)) errors.format = 'Format must be original, jpeg, png or webp.';
  else settings.format = format;

  // Max width / height — 'original' or a bounded pixel count.
  const ceiling = config.image.maxDimension;
  const parseDimension = (raw, key) => {
    if (raw === undefined || raw === null || raw === '' || raw === 'original') return 'original';
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors[key] = `${key} must be a number or "original".`;
      return 'original';
    }
    if (value < 1) {
      errors[key] = `${key} must be at least 1px.`;
      return 'original';
    }
    if (value > ceiling) {
      errors[key] = `${key} cannot be larger than ${ceiling}px.`;
      return 'original';
    }
    return Math.round(value);
  };

  settings.maxWidth = parseDimension(body.maxWidth, 'maxWidth');
  settings.maxHeight = parseDimension(body.maxHeight, 'maxHeight');

  // Optional maximum output size per image, provided in KB or MB.
  settings.maxOutputBytes = null;
  if (body.maxOutputSize !== undefined && body.maxOutputSize !== null && body.maxOutputSize !== '') {
    const size = Number(body.maxOutputSize);
    const unit = String(body.outputSizeUnit || 'kb').toLowerCase();
    if (!Number.isFinite(size) || size <= 0) {
      errors.maxOutputSize = 'Maximum file size must be a positive number.';
    } else if (!['kb', 'mb'].includes(unit)) {
      errors.outputSizeUnit = 'Maximum file size unit must be KB or MB.';
    } else {
      const bytes = size * (unit === 'mb' ? 1024 * 1024 : 1024);
      if (bytes < 1024) errors.maxOutputSize = 'Maximum file size must be at least 1 KB.';
      else if (bytes > 100 * 1024 * 1024) errors.maxOutputSize = 'Maximum file size cannot exceed 100 MB.';
      else settings.maxOutputBytes = Math.round(bytes);
    }
  }

  if (Object.keys(errors).length) throw new HttpError(400, Object.values(errors)[0], errors);
  return settings;
}

/* ------------------------------------------------------------------ *
 * Core compression
 * ------------------------------------------------------------------ */

/**
 * Compress one buffer with sharp.
 * `withoutEnlargement: true` means a "max width" never scales an image UP,
 * and the resize bounds are re-clamped inside the pipeline.
 */
async function compressOne(file, settings) {
  const source = sharp(file.buffer, {
    // Sharp decodes in a sandboxed libvips; never trust embedded profiles.
    failOn: 'error',
    limitInputPixels: 268402689, // ~16k x 16k, guards decompression bombs
  });

  let metadata;
  try {
    metadata = await source.metadata();
  } catch (error) {
    throw new HttpError(415, `"${sanitizeFilename(file.originalname)}" could not be decoded as an image. The file may be corrupt.`);
  }

  if (!metadata.width || !metadata.height) {
    throw new HttpError(415, `"${sanitizeFilename(file.originalname)}" has no readable image data.`);
  }

  const targetFormat = settings.format === 'original' ? (file.detectedFormat || metadata.format) : settings.format;
  if (!FORMAT_MIME[targetFormat]) {
    throw new HttpError(400, 'Unsupported output format.');
  }

  const encode = async (quality, scale = 1) => {
    const pipeline = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: 268402689,
    }).rotate(); // honour EXIF orientation before resizing

    const resize = {};
    if (settings.maxWidth !== 'original') resize.width = settings.maxWidth;
    if (settings.maxHeight !== 'original') resize.height = settings.maxHeight;
    if (scale < 1) {
      const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation);
      const sourceWidth = swapsDimensions ? metadata.height : metadata.width;
      const sourceHeight = swapsDimensions ? metadata.width : metadata.height;
      const scaledWidth = Math.max(1, Math.round(sourceWidth * scale));
      const scaledHeight = Math.max(1, Math.round(sourceHeight * scale));
      resize.width = resize.width ? Math.min(resize.width, scaledWidth) : scaledWidth;
      resize.height = resize.height ? Math.min(resize.height, scaledHeight) : scaledHeight;
    }
    if (Object.keys(resize).length) {
      pipeline.resize({ ...resize, fit: 'inside', withoutEnlargement: true });
    }

    if (targetFormat === 'jpeg') {
      pipeline.flatten({ background: '#ffffff' }).jpeg({
        quality,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      });
    } else if (targetFormat === 'png') {
      pipeline.png({
        compressionLevel: 9,
        quality,
        palette: quality <= 70,
        effort: 7,
      });
    } else {
      pipeline.webp({ quality, effort: 5 });
    }

    try {
      return await pipeline.toBuffer({ resolveWithObject: true });
    } catch (error) {
      throw new HttpError(422, `Failed to compress "${sanitizeFilename(file.originalname)}". Try a lower quality or a smaller size.`);
    }
  };

  let resolved = await encode(settings.quality);
  if (settings.maxOutputBytes && resolved.data.length > settings.maxOutputBytes) {
    let scale = 1;
    let fitted = false;

    // Prefer preserving dimensions; lower quality first, then progressively
    // resize only if even the minimum quality cannot meet the requested limit.
    for (let attempt = 0; attempt < 15 && !fitted; attempt += 1) {
      let low = 10;
      let high = settings.quality;
      let candidate = null;

      for (let search = 0; search < 5 && low <= high; search += 1) {
        const quality = Math.ceil((low + high) / 2);
        const trial = await encode(quality, scale);
        if (trial.data.length <= settings.maxOutputBytes) {
          candidate = trial;
          low = quality + 1;
        } else {
          high = quality - 1;
        }
      }

      if (candidate) {
        resolved = candidate;
        fitted = true;
      } else {
        resolved = await encode(10, scale);
        scale *= 0.6;
      }
    }
  }

  const output = resolved.data;
  const outputMetadata = resolved.info;

  const originalName = stripExtension(sanitizeFilename(file.originalname, 'image'));
  const outputName = `${originalName}.${FORMAT_EXT[targetFormat]}`;

  return {
    buffer: output,
    name: outputName,
    originalName: sanitizeFilename(file.originalname, 'image'),
    mime: FORMAT_MIME[targetFormat],
    originalSize: file.size,
    compressedSize: output.length,
    // What the user sees as the source dimensions (before any resize).
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    width: outputMetadata.width,
    height: outputMetadata.height,
    format: targetFormat,
    targetSizeMet: !settings.maxOutputBytes || output.length <= settings.maxOutputBytes,
    savedPercent: file.size > 0 ? Math.round((1 - output.length / file.size) * 100) : 0,
  };
}

async function recordActivity(userId, { fileCount, inputBytes, outputBytes }) {
  if (!userId || !db.isConnected()) return;
  try {
    await Activity.create({ user: userId, type: 'image-compress', fileCount, inputBytes, outputBytes });
  } catch (error) {
    console.warn(`[image] could not record activity: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/image/compress  (JSON response with per-image results)
 * Multipart: files[] + quality/format/maxWidth/maxHeight
 * ------------------------------------------------------------------ */
router.post('/compress', compressLimiter, requireAuth, imageUpload, async (req, res, next) => {
  try {
    assertFilesAreGenuine(req.files, { label: 'image', maxTotalBytes: config.image.maxTotalBytes });
    const settings = parseSettings(req.body);

    const results = [];
    let inputBytes = 0;
    let outputBytes = 0;

    for (const file of req.files) {
      const result = await compressOne(file, settings);
      inputBytes += result.originalSize;
      outputBytes += result.compressedSize;
      // Send the compressed bytes base64 so the client can preview and offer a
      // single-file download without a second round trip.
      results.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: result.name,
        originalName: result.originalName,
        mime: result.mime,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        originalWidth: result.originalWidth,
        originalHeight: result.originalHeight,
        width: result.width,
        height: result.height,
        format: result.format,
        targetSizeMet: result.targetSizeMet,
        savedPercent: result.savedPercent,
        data: result.buffer.toString('base64'),
      });
    }

    await recordActivity(req.user?._id, { fileCount: results.length, inputBytes, outputBytes });

    res.json({
      settings,
      summary: {
        count: results.length,
        originalSize: inputBytes,
        compressedSize: outputBytes,
        savedPercent: inputBytes > 0 ? Math.round((1 - outputBytes / inputBytes) * 100) : 0,
      },
      results,
    });
  } catch (error) {
    return next(error);
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/image/compress-and-zip — one archive of every result
 * ------------------------------------------------------------------ */
router.post('/compress-and-zip', compressLimiter, requireAuth, imageUpload, async (req, res, next) => {
  try {
    assertFilesAreGenuine(req.files, { label: 'image', maxTotalBytes: config.image.maxTotalBytes });
    const settings = parseSettings(req.body);

    const results = [];
    let inputBytes = 0;
    let outputBytes = 0;
    for (const file of req.files) {
      const result = await compressOne(file, settings);
      inputBytes += result.originalSize;
      outputBytes += result.compressedSize;
      results.push(result);
    }

    await recordActivity(req.user?._id, { fileCount: results.length, inputBytes, outputBytes });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="northstar_compressed_images.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });
    // Forward archive errors to the response instead of hanging the download.
    archive.on('warning', (err) => { if (err.code !== 'ENOENT') console.warn(`[image] zip warning: ${err.message}`); });
    archive.on('error', (err) => { console.error(`[image] zip error: ${err.message}`); res.destroy(); });

    archive.pipe(res);

    // Guarantee unique entry names when two inputs share a basename.
    const used = new Map();
    for (const result of results) {
      const count = used.get(result.name) || 0;
      used.set(result.name, count + 1);
      const entryName = count === 0 ? result.name : `${stripExtension(result.name)}(${count}).${FORMAT_EXT[result.format]}`;
      archive.append(result.buffer, { name: entryName });
    }

    await archive.finalize();
    return undefined;
  } catch (error) {
    return next(error);
  }
});

/* ------------------------------------------------------------------ *
 * GET /api/image/limits — lets the client validate before uploading
 * ------------------------------------------------------------------ */
router.get('/limits', (req, res) => {
  res.json({
    maxFiles: config.image.maxFiles,
    maxUploadMb: config.image.maxUploadMb,
    maxDimension: config.image.maxDimension,
    accepted: ['jpg', 'jpeg', 'png', 'webp'],
  });
});

module.exports = router;
