import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, FileImage, Home, Layers, LayoutDashboard, Star,
} from '../components/icons';

const DESTINATIONS = [
  {
    to: '/',
    icon: Home,
    title: 'Home',
    text: 'What NorthStar does, how the tools work, and how your files are handled.',
    accent: 'var(--blue)',
  },
  {
    to: '/pdf-merger',
    icon: Layers,
    title: 'PDF Merger',
    text: 'Combine PDFs in any order and download one clean document.',
    accent: 'var(--cyan)',
  },
  {
    to: '/image-compressor',
    icon: FileImage,
    title: 'Image Compressor',
    text: 'Shrink JPG, PNG and WEBP files with quality and size you control.',
    accent: 'var(--purple)',
  },
  {
    to: '/dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    text: 'See merge and compression counts for your signed-in workspace.',
    accent: 'var(--blue)',
  },
];

export default function NotFound() {
  const headingRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = 'Page not found — NorthStar';
    headingRef.current?.focus();
  }, [pathname]);

  const showPath = pathname && pathname !== '/';

  return (
    <div className="page page--top">
      <div className="not-found">
        <div className="not-found-hero glass-panel">
          <p className="eyebrow">
            <Star />
            Error 404
          </p>

          <p className="not-found-mark" aria-hidden="true">404</p>

          <h1 ref={headingRef} id="not-found-title" className="page-title" tabIndex={-1}>
            This page drifted out of orbit.
          </h1>

          <p className="page-sub">
            The address you opened is not a NorthStar page. Jump home, or pick a tool below.
          </p>

          {showPath && (
            <p className="not-found-path">
              We could not find
              {' '}
              <code>{pathname}</code>
            </p>
          )}

          <div className="action-row not-found-actions">
            <Link className="glass-button" to="/">
              <Home />
              Back to Home
            </Link>
            <Link className="glass-button glass-button--ghost" to="/dashboard">
              <LayoutDashboard />
              Open Dashboard
            </Link>
          </div>
        </div>

        <h2 className="not-found-label" id="not-found-destinations">
          Try one of these instead
        </h2>

        <nav aria-labelledby="not-found-destinations">
          <ul className="grid grid-2 not-found-grid">
            {DESTINATIONS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="glass-card tool-tile not-found-tile"
                >
                  <span
                    className="feature-icon"
                    style={{ background: `linear-gradient(135deg, ${item.accent}, #c084fc)` }}
                    aria-hidden="true"
                  >
                    <item.icon />
                  </span>
                  <h3 className="feature-title">{item.title}</h3>
                  <p className="feature-text">{item.text}</p>
                  <span className="tool-tile-arrow">
                    Go to {item.title} <ArrowRight />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
