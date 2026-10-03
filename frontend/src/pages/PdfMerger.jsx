import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Dropzone from '../components/Dropzone';
import Reveal from '../components/Reveal';
import { Loader } from '../components/Loader';
import { useToast } from '../context/ToastContext';
import { pdf as pdfApi } from '../lib/api';
import { downloadBlob, exactBytes, formatBytes, uid } from '../lib/format';
import {
  ArrowDown, ArrowUp, CheckCircle2, Download, FileText, Info, Layers,
  ShieldCheck, Trash, X, Zap,
} from '../components/icons';

/* Mirror of the server-side limits in backend/config/env.js. */
const MAX_FILES = Number(import.meta.env.VITE_PDF_MAX_FILES) || 20;
const MAX_FILE_MB = Number(import.meta.env.VITE_PDF_MAX_UPLOAD_MB) || 50;

function isPdf(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
}

export default function PdfMerger() {
  const { success, error, info } = useToast();

  const [files, setFiles] = useState([]);
  const [state, setState] = useState('normal');
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);

  const inputRef = useRef(null);
  const abortRef = useRef(null);
  // Set while a drag-reorder is in progress, so ordinary uploads are not
  // confused with row moves.
  const dragIndex = useRef(null);
  const overIndex = useRef(null);
  const progressTimer = useRef(null);

  useEffect(() => {
    document.title = 'PDF Merger — NorthStar';
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stopProgress = useCallback(() => {
    clearInterval(progressTimer.current);
    progressTimer.current = null;
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    setProgress(8);
    // Creep towards 90% — the real finish comes from the response itself.
    progressTimer.current = setInterval(() => {
      setProgress((value) => (value >= 90 ? value : value + (90 - value) * 0.12));
    }, 260);
  }, [stopProgress]);

  /* ---------------------------------------------------------------- *
   * File selection
   * ---------------------------------------------------------------- */

  const addFiles = useCallback(
    (incoming) => {
      const accepted = [];
      let rejected = 0;
      let tooBig = 0;

      for (const file of incoming) {
        if (!isPdf(file)) {
          rejected += 1;
          continue;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          tooBig += 1;
          continue;
        }
        accepted.push({
          id: uid(),
          file,
          name: file.name,
          size: file.size,
          pageCount: null, // filled in by the inspect call below
        });
      }

      if (rejected) error(`${rejected} file${rejected === 1 ? '' : 's'} skipped — only PDF files are allowed.`);
      if (tooBig) error(`${tooBig} file${tooBig === 1 ? '' : 's'} skipped — the limit is ${MAX_FILE_MB} MB each.`);

      if (!accepted.length) {
        setState('error');
        setTimeout(() => setState('normal'), 900);
        return;
      }

      setFiles((current) => {
        const next = [...current, ...accepted];
        if (next.length > MAX_FILES) {
          error(`You can merge up to ${MAX_FILES} files at once.`);
          return next.slice(0, MAX_FILES);
        }
        return next;
      });

      setState('success');
      setTimeout(() => setState('normal'), 1100);
      setResult(null);

      // Read real page counts so the cards are not guessing.
      inspect(accepted);
    },
    [error],
  );

  /** Ask the server how many pages each file actually has. */
  const inspect = useCallback(async (batch) => {
    const form = new FormData();
    batch.forEach((item) => form.append('files', item.file));
    try {
      const data = await pdfApi.inspect(form);
      const counts = new Map((data.files || []).map((f) => [f.name, f.pageCount]));
      setFiles((current) =>
        current.map((item) => {
          const match = counts.get(item.name);
          return match === undefined ? item : { ...item, pageCount: match };
        }),
      );
    } catch {
      // Page counts are a nicety; a failure here must not block the merge.
    }
  }, []);

  const removeFile = useCallback((id) => {
    setFiles((current) => current.filter((item) => item.id !== id));
    setResult(null);
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setResult(null);
    setProgress(0);
  }, []);

  /* ---------------------------------------------------------------- *
   * Reorder
   * ---------------------------------------------------------------- */

  const moveFile = useCallback((from, to) => {
    setFiles((current) => {
      if (to < 0 || to >= current.length || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResult(null);
  }, []);

  /* ---------------------------------------------------------------- *
   * Merge
   * ---------------------------------------------------------------- */

  const runMerge = useCallback(async () => {
    if (merging) return;
    if (files.length < 2) {
      error('Add at least two PDF files to merge.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setMerging(true);
    setResult(null);
    startProgress();

    try {
      const form = new FormData();
      files.forEach((item) => form.append('files', item.file));
      // Preserve the on-screen order explicitly rather than relying on the
      // order multer happened to stream the parts in.
      form.append('order', JSON.stringify(files.map((_, index) => index)));

      const merged = await pdfApi.merge(form, controller.signal);
      setProgress(100);
      downloadBlob(merged.blob, merged.name);

      const inputBytes = files.reduce((sum, item) => sum + item.size, 0);
      setResult({
        name: merged.name,
        size: merged.blob.size,
        pageCount: merged.pageCount,
        sourceCount: merged.sourceCount,
        savedPercent: inputBytes > 0 ? Math.round((1 - merged.blob.size / inputBytes) * 100) : 0,
      });

      success(
        `Merged ${files.length} PDFs into ${merged.pageCount ?? 'your'} page${merged.pageCount === 1 ? '' : 's'} — ${merged.name}`,
      );
    } catch (err) {
      if (err?.name === 'AbortError') return;
      error(err.message || 'The merge failed. Please try again.');
    } finally {
      stopProgress();
      setMerging(false);
      abortRef.current = null;
      setTimeout(() => setProgress(0), 900);
    }
  }, [files, merging, error, success, startProgress, stopProgress]);

  const totalSize = files.reduce((sum, item) => sum + item.size, 0);
  const totalPages = files.reduce((sum, item) => sum + (item.pageCount || 0), 0);
  const pagesKnown = files.some((item) => item.pageCount !== null);

  return (
    <div className="page page--top">
      <Reveal className="page-head">
        <p className="eyebrow">PDF Merger</p>
        <h1 className="page-title">
          Combine PDFs into <span className="glow-text">one clean document</span>
        </h1>
        <p className="page-sub">
          Add your files, put them in the order you want, and download the merged result.
          Nothing is stored — each upload lives in memory only for the length of the request.
        </p>
      </Reveal>

      <Reveal className="glass-panel" delay={80}>
        <Dropzone
          onFiles={addFiles}
          accept=".pdf,application/pdf"
          multiple
          state={state}
          icon={<Layers />}
          title="Drop your PDFs here"
          text="Drag files into this panel, or click anywhere on it to browse."
          hint={`Up to ${MAX_FILES} files · ${MAX_FILE_MB} MB each · PDF only`}
          buttonLabel="Upload PDFs"
          titleId="pdf-drop-title"
          describedBy="pdf-drop-hint"
        />
        <p id="pdf-drop-hint" className="sr-only">
          Accepts PDF files only, up to {MAX_FILES} files with a maximum size of {MAX_FILE_MB} megabytes each.
        </p>

        {files.length > 0 && (
          <>
            <div className="row-between mt-26 mb-14">
              <div className="row" style={{ gap: 16 }}>
                <p className="text-soft text-sm" role="status">
                  <strong style={{ color: 'var(--text)' }}>{files.length}</strong> file
                  {files.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
                  {pagesKnown && totalPages > 0 && ` · ${totalPages} page${totalPages === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={clearAll}
                disabled={merging}
                aria-label="Remove all files"
                title="Remove all"
              >
                <Trash />
              </button>
            </div>

            <ul className="file-list" aria-label="Files to merge, in order">
              {files.map((item, index) => (
                <li
                  key={item.id}
                  className="file-row"
                  draggable={!merging}
                  onDragStart={() => {
                    dragIndex.current = index;
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dragIndex.current !== null && overIndex.current !== index) {
                      overIndex.current = index;
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex.current !== null) moveFile(dragIndex.current, index);
                    dragIndex.current = null;
                    overIndex.current = null;
                  }}
                  onDragEnd={() => {
                    dragIndex.current = null;
                    overIndex.current = null;
                  }}
                >
                  <span className="file-order" title="Drag to reorder" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="file-thumb" aria-hidden="true">
                    <FileText />
                  </span>
                  <span className="file-meta">
                    <span className="file-name" title={item.name}>{item.name}</span>
                    <span className="file-sub">
                      <span>{formatBytes(item.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {item.pageCount === null
                          ? 'checking pages…'
                          : item.pageCount === 0
                            ? 'unreadable'
                            : `${item.pageCount} page${item.pageCount === 1 ? '' : 's'}`}
                      </span>
                    </span>
                  </span>
                  <span className="file-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => moveFile(index, index - 1)}
                      disabled={merging || index === 0}
                      aria-label={`Move ${item.name} earlier`}
                      title="Move earlier"
                    >
                      <ArrowUp />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => moveFile(index, index + 1)}
                      disabled={merging || index === files.length - 1}
                      aria-label={`Move ${item.name} later`}
                      title="Move later"
                    >
                      <ArrowDown />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => removeFile(item.id)}
                      disabled={merging}
                      aria-label={`Remove ${item.name}`}
                      title="Remove"
                    >
                      <X />
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            {files.length < 2 && (
              <p className="text-dim text-sm mt-14 row" style={{ gap: 7 }}>
                <Info style={{ width: 15, height: 15, flexShrink: 0 }} />
                Add one more PDF to enable merging.
              </p>
            )}

            {merging && (
              <div className="progress mt-20" role="status" aria-live="polite">
                <div className="progress-head">
                  <span className="row" style={{ gap: 9 }}>
                    <span className="spinner" aria-hidden="true" />
                    <span>Merging PDFs…</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(progress)}%</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Merge progress"
                >
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="action-row mt-26" style={{ justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="glass-button glass-button--lg"
                onClick={runMerge}
                disabled={merging || files.length < 2}
              >
                {merging ? <Loader text="Merging PDFs…" /> : <><Zap /> Merge PDFs</>}
              </button>
              <button
                type="button"
                className="glass-button glass-button--ghost glass-button--lg"
                onClick={() => setFiles([])}
                disabled={merging || files.length === 0}
              >
                Clear all
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="glass glass-card result-hero mt-32" role="status">
            <div className="result-icon" aria-hidden="true">
              <CheckCircle2 />
            </div>
            <h2 className="result-title">Merge Complete</h2>
            <p className="result-sub">
              {result.name} · downloaded automatically
            </p>

            <div className="metrics">
              <div className="metric">
                <span className="metric-label">Pages</span>
                <span className="metric-value">{result.pageCount ?? '—'}</span>
                <span className="metric-note">from {result.sourceCount} files</span>
              </div>
              <div className="metric">
                <span className="metric-label">Size</span>
                <span className="metric-value">{formatBytes(result.size)}</span>
                <span className="metric-note">{exactBytes(result.size)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Change</span>
                <span className={`metric-value ${result.savedPercent >= 0 ? 'metric-value--good' : 'metric-value--warn'}`}>
                  {result.savedPercent >= 0 ? `−${result.savedPercent}%` : `+${Math.abs(result.savedPercent)}%`}
                </span>
                <span className="metric-note">vs. total input</span>
              </div>
            </div>

            <div className="action-row">
              <Link className="glass-button glass-button--ghost" to="/image-compressor">
                Compress images instead
              </Link>
              <button type="button" className="glass-button glass-button--ghost" onClick={clearAll}>
                Merge another batch
              </button>
            </div>
          </div>
        )}

        <p className="text-dim text-sm mt-26 row" style={{ gap: 8 }}>
          <ShieldCheck style={{ width: 15, height: 15, color: 'var(--cyan)', flexShrink: 0 }} />
          Files are validated by their actual content, held in memory, and discarded when the merge finishes.
        </p>
      </Reveal>

      <p className="text-dim text-sm mt-20 row" style={{ gap: 8 }}>
        <Info style={{ width: 15, height: 15, flexShrink: 0 }} />
        This merge will be added to your{' '}
        <Link to="/dashboard" style={{ color: 'var(--blue)', fontWeight: 600 }}>dashboard</Link>.
      </p>
    </div>
  );
}
