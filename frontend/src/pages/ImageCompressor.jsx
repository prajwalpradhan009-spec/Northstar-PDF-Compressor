import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dropzone from '../components/Dropzone';
import Reveal from '../components/Reveal';
import { Loader } from '../components/Loader';
import { useToast } from '../context/ToastContext';
import { images as imagesApi } from '../lib/api';
import {
  base64ToBlob, clampInt, downloadBlob, exactBytes, formatBytes, uid,
} from '../lib/format';
import {
  Archive, CheckCircle2, Download, FileImage, Info, Settings as SettingsIcon,
  ShieldCheck, Trash, Upload, X, Zap,
} from '../components/icons';

/* Mirror of the server-side limits in backend/config/env.js. */
const MAX_FILES = 20;
const MAX_FILE_MB = 15;
const MAX_DIMENSION = 8000;

const ACCEPTED_MIME = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/x-webp'];
const ACCEPTED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

const FORMATS = [
  { value: 'original', label: 'Original' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WEBP' },
];

const DIMENSION_PRESETS = ['original', 1920, 1600, 1280];
const HEIGHT_PRESETS = ['original', 1080, 720];

const DEFAULT_SETTINGS = {
  quality: 80,
  format: 'original',
  maxWidth: 'original',
  maxHeight: 'original',
};

function isAcceptedImage(file) {
  const type = (file.type || '').toLowerCase();
  const ext = ((file.name || '').split('.').pop() || '').toLowerCase();
  return ACCEPTED_MIME.includes(type) || ACCEPTED_EXT.includes(ext);
}

/** Human label for a dimension setting, whether a preset or a custom number. */
function dimensionLabel(value) {
  if (value === 'original') return 'Original';
  return typeof value === 'number' ? `${value}px` : `${value}px`;
}

export default function ImageCompressor() {
  const { success, error, info } = useToast();

  const [images, setImages] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [dropState, setDropState] = useState('normal');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  const abortRef = useRef(null);
  const progressTimer = useRef(null);
  const previews = useRef(new Map());

  useEffect(() => {
    document.title = 'Image Compressor — NorthStar';
  }, []);

  /* Object URLs are revoked on unmount so previews never leak memory. */
  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearInterval(progressTimer.current);
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      previews.current.clear();
    },
    [],
  );

  const stopProgress = useCallback(() => {
    clearInterval(progressTimer.current);
    progressTimer.current = null;
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    setProgress(10);
    progressTimer.current = setInterval(() => {
      setProgress((value) => (value >= 92 ? value : value + (92 - value) * 0.1));
    }, 280);
  }, [stopProgress]);

  const patchSettings = useCallback((patch) => {
    setSettings((current) => ({ ...current, ...patch }));
    setResults(null);
  }, []);

  /* ---------------------------------------------------------------- *
   * Selection
   * ---------------------------------------------------------------- */

  const addImages = useCallback(
    (incoming) => {
      const accepted = [];
      let rejected = 0;
      let tooBig = 0;

      for (const file of incoming) {
        if (!isAcceptedImage(file)) {
          rejected += 1;
          continue;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          tooBig += 1;
          continue;
        }
        const id = uid();
        // Thumbnail for the card. Revoked when the card is removed.
        previews.current.set(id, URL.createObjectURL(file));
        accepted.push({
          id,
          file,
          name: file.name,
          size: file.size,
          width: null,
          height: null,
        });
      }

      if (rejected) error(`${rejected} file${rejected === 1 ? '' : 's'} skipped — only JPG, PNG and WEBP are allowed.`);
      if (tooBig) error(`${tooBig} file${tooBig === 1 ? '' : 's'} skipped — the limit is ${MAX_FILE_MB} MB each.`);

      if (!accepted.length) {
        setDropState('error');
        setTimeout(() => setDropState('normal'), 900);
        return;
      }

      setImages((current) => {
        const next = [...current, ...accepted];
        if (next.length > MAX_FILES) {
          error(`You can compress up to ${MAX_FILES} images at once.`);
          return next.slice(0, MAX_FILES);
        }
        return next;
      });

      setDropState('success');
      setTimeout(() => setDropState('normal'), 1100);
      setResults(null);

      // Read intrinsic dimensions locally — instant, no upload needed.
      accepted.forEach((item) => {
        const probe = new Image();
        probe.onload = () => {
          setImages((current) =>
            current.map((row) => (row.id === item.id ? { ...row, width: probe.naturalWidth, height: probe.naturalHeight } : row)),
          );
          URL.revokeObjectURL(probe.src);
        };
        probe.onerror = () => URL.revokeObjectURL(probe.src);
        probe.src = previews.current.get(item.id);
      });
    },
    [error],
  );

  const removeImage = useCallback((id) => {
    const url = previews.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previews.current.delete(id);
    }
    setImages((current) => current.filter((item) => item.id !== id));
    setResults(null);
  }, []);

  const clearAll = useCallback(() => {
    previews.current.forEach((url) => URL.revokeObjectURL(url));
    previews.current.clear();
    setImages([]);
    setResults(null);
    setProgress(0);
  }, []);

  /* ---------------------------------------------------------------- *
   * Compression
   * ---------------------------------------------------------------- */

  const buildForm = useCallback(() => {
    const form = new FormData();
    images.forEach((item) => form.append('files', item.file));
    form.append('quality', String(settings.quality));
    form.append('format', settings.format);
    form.append('maxWidth', String(settings.maxWidth));
    form.append('maxHeight', String(settings.maxHeight));
    return form;
  }, [images, settings]);

  const runCompress = useCallback(async () => {
    if (busy) return;
    if (!images.length) {
      error('Add at least one image to compress.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setResults(null);
    startProgress();

    try {
      const data = await imagesApi.compress(buildForm(), controller.signal);
      setProgress(100);

      // Map each result back to the file that produced it, by original name.
      const byName = new Map(images.map((item) => [item.name, item]));
      const merged = (data.results || []).map((row) => ({
        ...row,
        sourceId: byName.get(row.originalName)?.id ?? null,
        // Decode lazily via base64ToBlob — the preview URL is cached in state
        // so the DOM does not churn while scrolling.
      }));

      setResults({ ...data, results: merged });

      const saved = data.summary?.savedPercent ?? 0;
      if (saved > 0) {
        success(
          `Compression complete — ${formatBytes(data.summary.originalSize)} → ${formatBytes(data.summary.compressedSize)} (${saved}% smaller).`,
        );
      } else {
        info(
          `Compression finished, but these images are already well optimized (${formatBytes(data.summary.compressedSize)}). Try a lower quality or a smaller max width.`,
        );
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      error(err.message || 'Compression failed. Please try again.');
    } finally {
      stopProgress();
      setBusy(false);
      abortRef.current = null;
      setTimeout(() => setProgress(0), 900);
    }
  }, [images, settings, busy, error, success, info, buildForm, startProgress, stopProgress]);

  const downloadOne = useCallback(
    (result) => {
      if (!result) return;
      downloadBlob(base64ToBlob(result.data, result.mime), result.name);
    },
    [],
  );

  const downloadAll = useCallback(async () => {
    if (busy) return;
    // A single image is more useful as itself than zipped.
    if (images.length < 2) {
      downloadOne(results?.results?.[0]);
      return;
    }

    setBusy(true);
    try {
      const { blob, name } = await imagesApi.compressAndZip(buildForm());
      downloadBlob(blob, name);
      success(`Downloaded all ${images.length} images as a ZIP.`);
    } catch (err) {
      error(err.message || 'Could not build the ZIP archive.');
    } finally {
      setBusy(false);
    }
  }, [busy, images.length, results, buildForm, downloadOne, success, error]);

  /* ---------------------------------------------------------------- *
   * Derived
   * ---------------------------------------------------------------- */

  const totalSize = useMemo(() => images.reduce((sum, item) => sum + item.size, 0), [images]);
  const resultFor = useCallback(
    (id) => results?.results?.find((row) => row.sourceId === id) || null,
    [results],
  );

  const qualityFill = `${((settings.quality - 10) / 90) * 100}%`;

  return (
    <div className="page page--top">
      <Reveal className="page-head">
        <p className="eyebrow">Image Compressor</p>
        <h1 className="page-title">
          Compress images <span className="glow-text">without losing what matters</span>
        </h1>
        <p className="page-sub">
          Drop your images here. Choose a quality and size target, and the server rebuilds each file
          with Sharp. Download one at a time or take the whole batch as a ZIP.
        </p>
      </Reveal>

      <Reveal className="glass-panel" delay={80}>
        <Dropzone
          onFiles={addImages}
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          state={dropState}
          icon={<FileImage />}
          title="Drop your images here"
          text="Compress images without losing unnecessary quality."
          hint={`JPG, PNG, WEBP · up to ${MAX_FILES} images · ${MAX_FILE_MB} MB each`}
          buttonLabel="Choose Images"
          titleId="img-drop-title"
          describedBy="img-drop-hint"
        />
        <p id="img-drop-hint" className="sr-only">
          Accepts JPG, JPEG, PNG and WEBP images, up to {MAX_FILES} images with a maximum size of {MAX_FILE_MB} megabytes each.
        </p>

        {/* ---------------- Settings panel ---------------- */}
        {images.length > 0 && (
          <div className="glass glass-card mt-26" style={{ padding: 'clamp(18px, 3vw, 26px)' }}>
            <div className="row-between mb-20">
              <h2 className="row" style={{ fontSize: '1.05rem', gap: 9 }}>
                <SettingsIcon style={{ width: 18, height: 18, color: 'var(--blue)' }} />
                Compression settings
              </h2>
              <button
                type="button"
                className="glass-button glass-button--ghost glass-button--sm"
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  setCustomWidth('');
                  setCustomHeight('');
                  setResults(null);
                }}
                disabled={busy}
              >
                Reset
              </button>
            </div>

            <div className="settings-grid">
              {/* Quality */}
              <div className="setting">
                <div className="setting-head">
                  <label className="setting-name" htmlFor="quality-range">Quality</label>
                  <span className="setting-value">{settings.quality}%</span>
                </div>
                <input
                  id="quality-range"
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={settings.quality}
                  disabled={busy}
                  onChange={(event) => patchSettings({ quality: Number(event.target.value) })}
                  style={{ '--fill': qualityFill }}
                  aria-describedby="quality-help"
                />
                <div className="range-scale" aria-hidden="true">
                  <span>10%</span>
                  <span>55%</span>
                  <span>100%</span>
                </div>
                <p id="quality-help" className="text-dim text-sm" style={{ fontSize: '0.76rem' }}>
                  100% is visually lossless for JPEG/WEBP; 80% is a good default.
                </p>
              </div>

              {/* Format */}
              <div className="setting">
                <div className="setting-head">
                  <span className="setting-name" id="format-label">Format</span>
                </div>
                <div className="seg" role="group" aria-labelledby="format-label">
                  {FORMATS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`seg-btn${settings.format === option.value ? ' active' : ''}`}
                      aria-pressed={settings.format === option.value}
                      disabled={busy}
                      onClick={() => patchSettings({ format: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-dim text-sm" style={{ fontSize: '0.76rem' }}>
                  Transparent PNGs are flattened onto white if you choose JPEG.
                </p>
              </div>

              {/* Max width */}
              <div className="setting">
                <div className="setting-head">
                  <label className="setting-name" htmlFor="max-width-select">Maximum width</label>
                </div>
                <select
                  id="max-width-select"
                  className="glass-input"
                  value={String(settings.maxWidth)}
                  disabled={busy}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'custom') {
                      patchSettings({ maxWidth: clampInt(customWidth, 1, MAX_DIMENSION, 1280) });
                    } else {
                      patchSettings({ maxWidth: value === 'original' ? 'original' : Number(value) });
                    }
                  }}
                >
                  {DIMENSION_PRESETS.map((preset) => (
                    <option key={String(preset)} value={String(preset)}>
                      {dimensionLabel(preset)}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {(settings.maxWidth === 'original' ||
                  !DIMENSION_PRESETS.includes(settings.maxWidth)) && (
                  <input
                    type="number"
                    className="glass-input"
                    min="1"
                    max={MAX_DIMENSION}
                    placeholder="px"
                    value={customWidth}
                    disabled={busy}
                    aria-label="Custom maximum width in pixels"
                    onChange={(event) => {
                      setCustomWidth(event.target.value);
                      const parsed = clampInt(event.target.value, 1, MAX_DIMENSION, 0);
                      if (parsed) patchSettings({ maxWidth: parsed });
                    }}
                  />
                )}
              </div>

              {/* Max height */}
              <div className="setting">
                <div className="setting-head">
                  <label className="setting-name" htmlFor="max-height-select">Maximum height</label>
                </div>
                <select
                  id="max-height-select"
                  className="glass-input"
                  value={String(settings.maxHeight)}
                  disabled={busy}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'custom') {
                      patchSettings({ maxHeight: clampInt(customHeight, 1, MAX_DIMENSION, 720) });
                    } else {
                      patchSettings({ maxHeight: value === 'original' ? 'original' : Number(value) });
                    }
                  }}
                >
                  {HEIGHT_PRESETS.map((preset) => (
                    <option key={String(preset)} value={String(preset)}>
                      {dimensionLabel(preset)}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {(settings.maxHeight === 'original' ||
                  !HEIGHT_PRESETS.includes(settings.maxHeight)) && (
                  <input
                    type="number"
                    className="glass-input"
                    min="1"
                    max={MAX_DIMENSION}
                    placeholder="px"
                    value={customHeight}
                    disabled={busy}
                    aria-label="Custom maximum height in pixels"
                    onChange={(event) => {
                      setCustomHeight(event.target.value);
                      const parsed = clampInt(event.target.value, 1, MAX_DIMENSION, 0);
                      if (parsed) patchSettings({ maxHeight: parsed });
                    }}
                  />
                )}
              </div>
            </div>

            <p className="text-dim text-sm mt-20 row" style={{ gap: 7, fontSize: '0.8rem' }}>
              <Info style={{ width: 14, height: 14, flexShrink: 0 }} />
              Images are never enlarged — a maximum size only ever scales down.
            </p>
          </div>
        )}

        {/* ---------------- File list ---------------- */}
        {images.length > 0 && (
          <>
            <div className="row-between mt-26 mb-14">
              <p className="text-soft text-sm" role="status">
                <strong style={{ color: 'var(--text)' }}>{images.length}</strong> image
                {images.length === 1 ? '' : 's'} · {formatBytes(totalSize)}
              </p>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={clearAll}
                disabled={busy}
                aria-label="Remove all images"
                title="Remove all"
              >
                <Trash />
              </button>
            </div>

            <ul className="file-list" aria-label="Images queued for compression">
              {images.map((item) => {
                const result = resultFor(item.id);
                const url = previews.current.get(item.id);
                return (
                  <li key={item.id} className="file-row">
                    <span className="file-thumb" aria-hidden="true">
                      {url ? <img src={url} alt="" loading="lazy" /> : <FileImage />}
                    </span>
                    <span className="file-meta">
                      <span className="file-name" title={item.name}>{item.name}</span>
                      <span className="file-sub">
                        <span>Original {formatBytes(item.size)}</span>
                        {item.width ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.width}×{item.height}px</span>
                          </>
                        ) : null}
                        {result && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: 'var(--text-soft)' }}>
                              → {result.width}×{result.height}px {formatBytes(result.compressedSize)}
                            </span>
                          </>
                        )}
                      </span>
                    </span>

                    {result && (
                      <span className={`saved-badge${result.savedPercent <= 0 ? ' saved-badge--up' : ''}`}>
                        {result.savedPercent > 0 ? `−${result.savedPercent}%` : `+${Math.abs(result.savedPercent)}%`}
                      </span>
                    )}

                    <span className="file-actions">
                      {result && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--accent"
                          onClick={() => downloadOne(result)}
                          aria-label={`Download compressed ${result.name}`}
                          title="Download compressed"
                        >
                          <Download />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => removeImage(item.id)}
                        disabled={busy}
                        aria-label={`Remove ${item.name}`}
                        title="Remove"
                      >
                        <X />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>

            {busy && (
              <div className="progress mt-20" role="status" aria-live="polite">
                <div className="progress-head">
                  <span className="row" style={{ gap: 9 }}>
                    <span className="spinner" aria-hidden="true" />
                    <span>Compressing images…</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(progress)}%</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Compression progress"
                >
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="action-row mt-26" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="glass-button glass-button--lg" onClick={runCompress} disabled={busy}>
                {busy ? <Loader text="Compressing images…" /> : <><Zap /> Compress Images</>}
              </button>
              <button
                type="button"
                className="glass-button glass-button--ghost glass-button--lg"
                onClick={downloadAll}
                disabled={busy || !images.length}
              >
                <Archive /> Download All
              </button>
            </div>
          </>
        )}

        {/* ---------------- Result panel ---------------- */}
        {results && (
          <div className="glass-panel result-hero mt-32" role="status">
            <div className="result-icon" aria-hidden="true">
              <CheckCircle2 />
            </div>
            <h2 className="result-title">Compression Complete</h2>
            <p className="result-sub">
              {results.summary.count} image{results.summary.count === 1 ? '' : 's'} processed at {settings.quality}% quality
              {settings.format !== 'original' ? ` · converted to ${settings.format.toUpperCase()}` : ''}
            </p>

            <div className="metrics">
              <div className="metric">
                <span className="metric-label">Original</span>
                <span className="metric-value">{formatBytes(results.summary.originalSize)}</span>
                <span className="metric-note">{exactBytes(results.summary.originalSize)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Compressed</span>
                <span className="metric-value">{formatBytes(results.summary.compressedSize)}</span>
                <span className="metric-note">{exactBytes(results.summary.compressedSize)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Saved</span>
                <span
                  className={`metric-value ${results.summary.savedPercent > 0 ? 'metric-value--good' : 'metric-value--warn'}`}
                >
                  {results.summary.savedPercent}%
                </span>
                <span className="metric-note">
                  {formatBytes(Math.max(0, results.summary.originalSize - results.summary.compressedSize))} lighter
                </span>
              </div>
            </div>

            <div className="action-row">
              {results.results.length === 1 ? (
                <button type="button" className="glass-button" onClick={() => downloadOne(results.results[0])}>
                  <Download /> Download Image
                </button>
              ) : (
                <button type="button" className="glass-button" onClick={downloadAll} disabled={busy}>
                  <Archive /> Download All
                </button>
              )}
              <button type="button" className="glass-button glass-button--ghost" onClick={clearAll}>
                <Upload /> Compress Another
              </button>
            </div>
          </div>
        )}

        <p className="text-dim text-sm mt-26 row" style={{ gap: 8 }}>
          <ShieldCheck style={{ width: 15, height: 15, color: 'var(--cyan)', flexShrink: 0 }} />
          Each upload is checked against its real encoding, processed in memory by Sharp, then discarded.
        </p>
      </Reveal>
    </div>
  );
}
