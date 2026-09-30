import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="row" style={{ gap: 10 }}>
          <img
            className="brand-logo brand-logo--sm"
            src="/logo-128.png"
            alt=""
            aria-hidden="true"
            width="26"
            height="26"
          />
          <span className="footer-note">
            &copy; {year} NorthStar — PDF &amp; image tools.
          </span>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <Link className="footer-link" to="/pdf-merger">PDF Merger</Link>
          <Link className="footer-link" to="/image-compressor">Image Compressor</Link>
          <Link className="footer-link" to="/#faq">FAQ</Link>
          <Link className="footer-link" to="/signin">Sign In</Link>
        </nav>
      </div>
    </footer>
  );
}
