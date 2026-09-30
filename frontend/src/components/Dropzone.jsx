import { useCallback, useRef, useState } from 'react';
import { Upload } from './icons';

/**
 * Accessible drag-and-drop upload area.
 *
 * The whole panel is a real `<button>`, so it is reachable by keyboard and
 * announced correctly without any extra ARIA. Drag state is tracked with a
 * counter rather than a boolean, because `dragleave` also fires when you move
 * over a child element — a counter makes the highlight behave correctly.
 */
export default function Dropzone({
  onFiles,
  accept = '.pdf,application/pdf',
  multiple = true,
  state = 'normal', // normal | dragging | success | error
  title = 'Drop your files here',
  text = 'or click to browse',
  hint,
  icon,
  buttonLabel = 'Choose Files',
  disabled = false,
  titleId,
  describedBy,
}) {
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length) onFiles(files);
    },
    [disabled, onFiles],
  );

  const handleInput = useCallback(
    (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length) onFiles(files);
      // Reset so picking the same file twice still fires a change event.
      event.target.value = '';
    },
    [onFiles],
  );

  // `state === 'dragging'` from the parent (e.g. an upload rejected) takes
  // priority over the locally-tracked pointer state.
  const visualState = isDragging ? 'dragging' : state;
  const className = `dropzone${visualState !== 'normal' ? ` dropzone--${visualState}` : ''}`;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInput}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className={className}
        onClick={openPicker}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={handleDrop}
        disabled={disabled}
        aria-label={`${title}. ${text}`}
        aria-describedby={describedBy}
        aria-labelledby={titleId}
      >
        <span className="dropzone-icon" aria-hidden="true">
          {icon || <Upload />}
        </span>
        <span className="dropzone-title">{title}</span>
        {text && <span className="dropzone-text">{text}</span>}
        {hint && <span className="dropzone-hint">{hint}</span>}
        <span className="dropzone-actions">
          <span className="glass-button glass-button--sm">
            {buttonLabel}
          </span>
        </span>
      </button>
    </>
  );
}
