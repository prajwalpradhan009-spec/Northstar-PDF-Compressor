/** Inline spinner + label, and the full-screen blocking variant. */
export function Loader({ text, size = 'sm' }) {
  return (
    <span className="loader" role="status">
      <span className={`spinner${size === 'lg' ? ' spinner--lg' : ''}`} aria-hidden="true" />
      {text ? <span>{text}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Blocks the page while a destructive/irreversible request runs. */
export function LoaderOverlay({ text = 'Working…' }) {
  return (
    <div className="loader-overlay" role="alertdialog" aria-busy="true" aria-label={text}>
      <div className="glass loader-card">
        <span className="spinner spinner--lg" aria-hidden="true" />
        <p className="loader-text">{text}</p>
      </div>
    </div>
  );
}

export default Loader;
