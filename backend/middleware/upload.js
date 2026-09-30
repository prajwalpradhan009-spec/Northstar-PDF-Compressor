const multer = require('multer');
const config = require('../config/env');
const { HttpError } = require('../lib/validate');

/**
 * All uploads are held in memory only.
 *
 * Nothing is ever written to disk, so there is no temp directory to clean up
 * and no opportunity for an uploaded file to be executed, served or traversed
 * later. Multer's size/count limits are the first line of defence; the
 * `fileFilter` and the magic-byte sniffers below are the real gate.
 */
const storage = multer.memoryStorage();

/** A fixed byte cost per non-file part, used for accurate total-size limits. */
const PART_OVERHEAD_BYTES = 1024 * 1024;

function makeUploader({ maxFiles, maxFileBytes, maxTotalBytes, label }) {
  return multer({
    storage,
    limits: {
      fileSize: maxFileBytes,
      files: maxFiles,
      // Parts include the text fields alongside the files.
      parts: maxFiles + 8,
      fields: 24,
      fieldSize: 64 * 1024,
      headerPairs: 2000,
    },
    fileFilter(req, file, cb) {
      // Reject on the declared MIME *and* the extension. Neither is trusted on
      // its own — the buffer is sniffed again after upload.
      const declared = (file.mimetype || '').toLowerCase();
      const ext = (file.originalname || '').split('.').pop().toLowerCase();
      const allowed = LABELS[label];
      if (allowed.mimes.includes(declared) || allowed.exts.includes(ext)) {
        return cb(null, true);
      }
      return cb(new HttpError(415, `Unsupported file format. ${label} accepts ${allowed.display}.`));
    },
  }).array('files', maxFiles);
}

const LABELS = {
  pdf: { mimes: ['application/pdf', 'application/x-pdf'], exts: ['pdf'], display: 'PDF files only' },
  image: {
    mimes: ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/x-webp'],
    exts: ['jpg', 'jpeg', 'png', 'webp'],
    display: 'JPG, PNG and WEBP images only',
  },
};

/* ------------------------------------------------------------------ *
 * Magic-byte sniffing — the actual file-type check.
 * A renamed .exe or a crafted .jpg is rejected here even though it
 * passed the extension and MIME filters above.
 * ------------------------------------------------------------------ */

function isPdfBuffer(buffer) {
  // "%PDF-" is required within the first 1KB; some generators emit junk first.
  const window = buffer.subarray(0, 1024).toString('latin1');
  return window.includes('%PDF-');
}

function detectImageFormat(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return 'png';
  }
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'webp'; // "RIFF"...."WEBP"
  }
  return null;
}

/**
 * Verify that each buffered file really is what it claims, and that the batch
 * fits the total budget. Throws an HttpError with a readable message otherwise.
 */
function assertFilesAreGenuine(files, { label, maxTotalBytes }) {
  if (!files || files.length === 0) {
    throw new HttpError(400, `No ${label === 'pdf' ? 'PDF' : 'image'} files were uploaded.`);
  }

  const allowed = LABELS[label];
  let total = 0;

  for (const file of files) {
    total += file.size;
    if (total > maxTotalBytes) {
      throw new HttpError(413, `Upload is too large. Keep the whole batch under ${Math.round(maxTotalBytes / 1024 / 1024)} MB.`);
    }
    if (file.size === 0) {
      throw new HttpError(400, `"${file.originalname}" is empty.`);
    }

    if (label === 'pdf') {
      if (!isPdfBuffer(file.buffer)) {
        throw new HttpError(415, `"${file.originalname}" is not a valid PDF. The file content does not match a PDF.`);
      }
    } else {
      const detected = detectImageFormat(file.buffer);
      if (!detected || !config.image.allowedFormats.includes(detected)) {
        throw new HttpError(415, `"${file.originalname}" is not a valid image. ${allowed.display}.`);
      }
      // Trust the bytes from here on, not the client's filename.
      file.detectedFormat = detected;
    }
  }
}

/** Map multer's own error codes onto clear client messages. */
function uploadErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = config[err.field === 'files' && req.uploadLabel === 'image' ? 'image' : 'pdf'].maxUploadMb;
      return res.status(413).json({ error: `That file is too large. The limit is ${mb} MB per file.` });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_PART_COUNT') {
      const limit = req.uploadLabel === 'image' ? config.image.maxFiles : config.pdf.maxFiles;
      return res.status(413).json({ error: `Too many files. You can upload up to ${limit} at a time.` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field. Use the "files" field.' });
    }
    return res.status(400).json({ error: 'The upload could not be processed.' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  return next(err);
}

const uploadPdfFiles = makeUploader({
  label: 'pdf',
  maxFiles: config.pdf.maxFiles,
  maxFileBytes: config.pdf.maxUploadBytes,
  maxTotalBytes: config.pdf.maxTotalBytes + PART_OVERHEAD_BYTES,
});

const uploadImageFiles = makeUploader({
  label: 'image',
  maxFiles: config.image.maxFiles,
  maxFileBytes: config.image.maxUploadBytes,
  maxTotalBytes: config.image.maxTotalBytes + PART_OVERHEAD_BYTES,
});

/** Wrappers that tag the request so the error handler knows which limits apply. */
const pdfUpload = (req, res, next) => { req.uploadLabel = 'pdf'; uploadPdfFiles(req, res, next); };
const imageUpload = (req, res, next) => { req.uploadLabel = 'image'; uploadImageFiles(req, res, next); };

module.exports = {
  pdfUpload,
  imageUpload,
  uploadErrorHandler,
  assertFilesAreGenuine,
  isPdfBuffer,
  detectImageFormat,
  LABELS,
};
