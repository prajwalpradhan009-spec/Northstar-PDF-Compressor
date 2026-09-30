import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Home } from '../components/icons';

export default function NotFound() {
  // Send focus to the heading so the route change is announced.
  useEffect(() => {
    document.title = 'Page not found — NorthStar';
  }, []);

  return (
    <div className="page page--narrow center">
      <div className="glass-panel mt-32" style={{ padding: 'clamp(28px, 5vw, 48px)' }}>
        <p className="eyebrow">Error 404</p>
        <h1 className="page-title">This page drifted out of orbit.</h1>
        <p className="page-sub" style={{ marginBottom: 26 }}>
          The page you were looking for does not exist. Here&apos;s the way back.
        </p>
        <div className="action-row">
          <Link className="glass-button" to="/">
            <Home />
            Back to Home
          </Link>
          <Link className="glass-button glass-button--ghost" to="/pdf-merger">
            <FileText />
            PDF Merger
          </Link>
        </div>
      </div>
    </div>
  );
}
