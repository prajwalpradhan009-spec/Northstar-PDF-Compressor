const express = require('express');
const rateLimit = require('express-rate-limit');
const { PDFDocument } = require('pdf-lib');
const config = require('../config/env');
const { pdfUpload, assertFilesAreGenuine } = require('../middleware/upload');
const { requireAuth } = require('../middleware/auth');
const { HttpError, sanitizeFilename, stripExtension, contentDisposition } = require('../lib/validate');
const Activity = require('../models/Activity');
const db = require('../config/db');

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many merge requests. Please wait a moment and try again.' },
});

/** Pull `order` from the request so the client can reorder before merging. */
function requestedOrder(req, count) {
  const raw = req.body?.order;
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== count) return null;
  // Every index exactly once, otherwise fall back to upload order.
  const indexes = parsed.map(Number);
  const sorted = [...indexes].sort((a, b) => a - b);
  const isPermutation = sorted.every((value, position) => value === position);
  return isPermutation ? indexes : null;
}

function safeOutputName(files) {
  if (files.length === 1) {
    return `${stripExtension(sanitizeFilename(files[0].originalname, 'document'))}_merged.pdf`;
  }
  return 'northstar_merged.pdf';
}

async function recordActivity(userId, { fileCount, inputBytes, outputBytes }) {
  // Stats must never fail a user's merge — the download already succeeded.
  if (!userId || !db.isConnected()) return;
  try {
    await Activity.create({
      user: userId,
      type: 'pdf-merge',
      fileCount,
      inputBytes,
      outputBytes,
    });
  } catch (error) {
    console.warn(`[pdf] could not record activity: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/pdf/merge
 * Multipart field: files[]  (1..PDF_MAX_FILES)
 * Optional field:    order  (JSON array of indices, for reordering)
 * ------------------------------------------------------------------ */
router.post('/merge', uploadLimiter, requireAuth, pdfUpload, async (req, res, next) => {
  try {
    assertFilesAreGenuine(req.files, { label: 'pdf', maxTotalBytes: config.pdf.maxTotalBytes });

    const order = requestedOrder(req, req.files.length);
    const ordered = order ? order.map((index) => req.files[index]) : req.files;

    const merged = await PDFDocument.create();
    let totalPages = 0;
    const sources = [];

    for (const file of ordered) {
      let source;
      try {
        source = await PDFDocument.load(file.buffer, {
          // Ignore the embedded page tree so a damaged xref does not fail the
          // whole batch; updateMetadata keeps merged output tidy.
          ignoreEncryption: false,
          updateMetadata: false,
        });
      } catch (error) {
        throw new HttpError(415, `"${sanitizeFilename(file.originalname)}" is not a readable PDF. The file may be corrupt or password-protected.`);
      }
      if (source.getPageCount() === 0) {
        throw new HttpError(415, `"${sanitizeFilename(file.originalname)}" has no pages.`);
      }
      totalPages += source.getPageCount();
      if (totalPages > config.pdf.maxPages) {
        throw new HttpError(413, `Merged documents would exceed ${config.pdf.maxPages} pages. Merge fewer or smaller files.`);
      }
      sources.push(source);
    }

    for (const source of sources) {
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }

    merged.setProducer('NorthStar PDF Merger');
    merged.setCreator('NorthStar');
    merged.setCreationDate(new Date());

    const bytes = await merged.save({ useObjectStreams: true });

    const filename = safeOutputName(ordered);
    await recordActivity(req.user?._id, {
      fileCount: ordered.length,
      inputBytes: ordered.reduce((sum, file) => sum + file.size, 0),
      outputBytes: bytes.length,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('X-Page-Count', String(totalPages));
    res.setHeader('X-Source-Count', String(ordered.length));
    return res.send(Buffer.from(bytes));
  } catch (error) {
    return next(error);
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/pdf/inspect — page counts for the upload cards
 * ------------------------------------------------------------------ */
router.post('/inspect', uploadLimiter, requireAuth, pdfUpload, async (req, res, next) => {
  try {
    assertFilesAreGenuine(req.files, { label: 'pdf', maxTotalBytes: config.pdf.maxTotalBytes });

    const results = [];
    for (const file of req.files) {
      let pageCount = null;
      try {
        const doc = await PDFDocument.load(file.buffer, { ignoreEncryption: true, updateMetadata: false });
        pageCount = doc.getPageCount();
      } catch {
        // A file that cannot be parsed still merges-fails later; report 0 here
        // rather than rejecting the whole drop.
        pageCount = 0;
      }
      results.push({
        name: sanitizeFilename(file.originalname, 'document.pdf'),
        size: file.size,
        pageCount,
      });
    }

    res.json({ files: results });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
