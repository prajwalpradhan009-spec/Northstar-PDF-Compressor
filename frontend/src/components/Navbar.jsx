import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../lib/format';
import {
  ChevronDown, FileImage, FileText, HelpCircle, LayoutDashboard, LogOut, Menu,
  Moon, RotateCw, Scissors, Settings, ShieldCheck, Sparkle, Star, Sun, User, X, Zap,
} from './icons';

export default function Navbar() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('northstar_theme') || 'dark';
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('northstar_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((curr) => (curr === 'dark' ? 'light' : 'dark'));
  };

  const userDropdownRef = useRef(null);
  const pdfDropdownRef = useRef(null);
  const imageDropdownRef = useRef(null);
  const lastScroll = useRef(0);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setUserDropdownOpen(false);
    setPdfMenuOpen(false);
    setImageMenuOpen(false);
  }, [location.pathname, location.hash]);

  // Hide on scroll-down, reveal on scroll-up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 90 && y > lastScroll.current) setHidden(true);
      else setHidden(false);
      lastScroll.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Dismiss dropdowns on outside click or Escape
  useEffect(() => {
    const onPointerDown = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(event.target)) {
        setPdfMenuOpen(false);
      }
      if (imageDropdownRef.current && !imageDropdownRef.current.contains(event.target)) {
        setImageMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
        setPdfMenuOpen(false);
        setImageMenuOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      success('You have been signed out.');
      navigate('/');
    } catch (err) {
      error(err.message || 'Could not sign out. Please try again.');
    } finally {
      setLoggingOut(false);
      setUserDropdownOpen(false);
    }
  };

  return (
    <nav className={`nav${hidden ? ' nav--hidden' : ''}`} aria-label="Main navigation">
      <div className="nav-inner">
        {/* Brand */}
        <Link to="/" className="brand" aria-label="NorthStar home">
          <div className="brand-logo-wrap">
            <img className="brand-logo" src="/logo-128.png" alt="" aria-hidden="true" width="34" height="34" />
          </div>
          <span className="brand-text">NorthStar</span>
        </Link>

        {/* Desktop / Mobile Nav Links */}
        <div className={`nav-links${menuOpen ? ' open' : ''}`} id="northstar-mobile-menu">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive && !location.hash ? ' active' : ''}`}
          >
            Home
          </NavLink>

          {/* PDF Tools Dropdown */}
          <div
            className="nav-item-dropdown"
            ref={pdfDropdownRef}
            onMouseEnter={() => setPdfMenuOpen(true)}
            onMouseLeave={() => setPdfMenuOpen(false)}
          >
            <button
              type="button"
              className={`nav-link nav-dropdown-trigger${location.pathname === '/pdf-merger' ? ' active' : ''}`}
              onClick={() => setPdfMenuOpen((prev) => !prev)}
              aria-expanded={pdfMenuOpen}
            >
              <span>PDF Tools</span>
              <ChevronDown style={{ width: 13, height: 13, transition: 'transform 0.2s', transform: pdfMenuOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {pdfMenuOpen && (
              <div className="nav-dropdown-menu">
                <Link to="/pdf-merger" className="nav-dropdown-item" onClick={() => setPdfMenuOpen(false)}>
                  <FileText style={{ width: 15, height: 15, color: '#19D9FF' }} />
                  <div>
                    <div className="dropdown-title">PDF Merger</div>
                    <div className="dropdown-desc">Combine multiple PDFs in sequence</div>
                  </div>
                </Link>
                <a href="/#toolkit" className="nav-dropdown-item" onClick={() => setPdfMenuOpen(false)}>
                  <Scissors style={{ width: 15, height: 15, color: '#20E3A2' }} />
                  <div>
                    <div className="dropdown-title">Split PDF</div>
                    <div className="dropdown-desc">Extract pages into separate files</div>
                  </div>
                </a>
                <a href="/#toolkit" className="nav-dropdown-item" onClick={() => setPdfMenuOpen(false)}>
                  <RotateCw style={{ width: 15, height: 15, color: '#8057FF' }} />
                  <div>
                    <div className="dropdown-title">Rotate PDF</div>
                    <div className="dropdown-desc">Fix page orientations instantly</div>
                  </div>
                </a>
                <a href="/#toolkit" className="nav-dropdown-item" onClick={() => setPdfMenuOpen(false)}>
                  <ShieldCheck style={{ width: 15, height: 15, color: '#1769FF' }} />
                  <div>
                    <div className="dropdown-title">Protect PDF</div>
                    <div className="dropdown-desc">Encrypt and lock with password</div>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Image Tools Dropdown */}
          <div
            className="nav-item-dropdown"
            ref={imageDropdownRef}
            onMouseEnter={() => setImageMenuOpen(true)}
            onMouseLeave={() => setImageMenuOpen(false)}
          >
            <button
              type="button"
              className={`nav-link nav-dropdown-trigger${location.pathname === '/image-compressor' ? ' active' : ''}`}
              onClick={() => setImageMenuOpen((prev) => !prev)}
              aria-expanded={imageMenuOpen}
            >
              <span>Image Tools</span>
              <ChevronDown style={{ width: 13, height: 13, transition: 'transform 0.2s', transform: imageMenuOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {imageMenuOpen && (
              <div className="nav-dropdown-menu">
                <Link to="/image-compressor" className="nav-dropdown-item" onClick={() => setImageMenuOpen(false)}>
                  <FileImage style={{ width: 15, height: 15, color: '#19D9FF' }} />
                  <div>
                    <div className="dropdown-title">Image Compressor</div>
                    <div className="dropdown-desc">Lossy & lossless batch compression</div>
                  </div>
                </Link>
                <a href="/#toolkit" className="nav-dropdown-item" onClick={() => setImageMenuOpen(false)}>
                  <Zap style={{ width: 15, height: 15, color: '#20E3A2' }} />
                  <div>
                    <div className="dropdown-title">WebP &amp; JPG Converter</div>
                    <div className="dropdown-desc">Convert formats with optimal quality</div>
                  </div>
                </a>
              </div>
            )}
          </div>

          <a href="/#toolkit" className="nav-link">
            Features
          </a>
          <a href="/#how-it-works" className="nav-link">
            How It Works
          </a>
          <a href="/#faq" className="nav-link">
            FAQ
          </a>

          {isAuthenticated && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/account"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Account
              </NavLink>
            </>
          )}
        </div>

        {/* Right Actions */}
        <div className="nav-actions">
          {/* Dark / Light Mode Toggle Button */}
          <button
            type="button"
            className="nav-icon-btn"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun style={{ width: 17, height: 17 }} /> : <Moon style={{ width: 17, height: 17 }} />}
          </button>

          {loading ? (
            <span className="spinner" aria-label="Checking session" />
          ) : isAuthenticated ? (
            <div className="user-pill" ref={userDropdownRef}>
              <button
                type="button"
                className="user-trigger"
                onClick={() => setUserDropdownOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={userDropdownOpen}
              >
                <span className="avatar" aria-hidden="true">
                  {initials(user?.name)}
                </span>
                <span className="user-name">{user?.name}</span>
                <ChevronDown style={{ width: 13, height: 13 }} />
              </button>

              {userDropdownOpen && (
                <div className="dropdown" role="menu">
                  <div className="dropdown-head">
                    <p className="dropdown-name">{user?.name}</p>
                    <p className="dropdown-email">{user?.email}</p>
                  </div>
                  <Link to="/dashboard" className="dropdown-item" role="menuitem">
                    <LayoutDashboard style={{ width: 16, height: 16 }} />
                    Dashboard
                  </Link>
                  <Link to="/account" className="dropdown-item" role="menuitem">
                    <Settings style={{ width: 16, height: 16 }} />
                    Account
                  </Link>
                  <button
                    type="button"
                    className="dropdown-item dropdown-item--danger"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    role="menuitem"
                  >
                    <LogOut style={{ width: 16, height: 16 }} />
                    {loggingOut ? 'Signing out…' : 'Logout'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/signin" className="nav-btn-signin">
                Sign In
              </Link>
              <Link to="/signup" className="nav-btn-signup">
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="northstar-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </nav>
  );
}
