import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../lib/format';
import {
  FileImage, FileText, HelpCircle, LayoutDashboard, LogOut, Menu, Settings,
  Sparkle, Star, User, X, Zap,
} from './icons';

const PUBLIC_LINKS = [
  { to: '/', label: 'Home', end: true, icon: Star },
  { to: '/pdf-merger', label: 'PDF Merger', icon: FileText },
  { to: '/image-compressor', label: 'Image Compressor', icon: FileImage },
  { to: '/#features', label: 'Features', icon: Sparkle, hash: true },
  { to: '/#how-it-works', label: 'How It Works', icon: Zap, hash: true },
  { to: '/#faq', label: 'FAQ', icon: HelpCircle, hash: true },
];

export default function Navbar() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const dropdownRef = useRef(null);
  const lastScroll = useRef(0);

  // Close the mobile sheet and dropdown whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
  }, [location.pathname, location.hash]);

  // Hide the bar on scroll-down, bring it back on scroll-up.
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

  // Dismiss the dropdown on an outside click or Escape.
  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const onPointerDown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setDropdownOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dropdownOpen]);

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
      setDropdownOpen(false);
    }
  };

  const links = isAuthenticated
    ? [
        { to: '/', label: 'Home', end: true, icon: Star },
        { to: '/pdf-merger', label: 'PDF Merger', icon: FileText },
        { to: '/image-compressor', label: 'Image Compressor', icon: FileImage },
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/account', label: 'Account', icon: User },
      ]
    : PUBLIC_LINKS;

  return (
    <nav className={`nav${hidden ? ' nav--hidden' : ''}`} aria-label="Main navigation">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="NorthStar home">
          <img className="brand-logo" src="/logo-128.png" alt="" aria-hidden="true" width="34" height="34" />
          <span className="brand-text">NORTHSTAR</span>
        </Link>

        <div className={`nav-links${menuOpen ? ' open' : ''}`} id="northstar-mobile-menu">
          {links.map(({ to, label, icon: Icon, end, hash }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive && !hash ? ' active' : ''}`}
            >
              <span className="row" style={{ gap: 7, flexWrap: 'nowrap' }}>
                <Icon style={{ width: 15, height: 15 }} />
                {label}
              </span>
            </NavLink>
          ))}
        </div>

        <div className="nav-actions">
          {loading ? (
            <span className="spinner" aria-label="Checking your session" />
          ) : isAuthenticated ? (
            <div className="user-pill" ref={dropdownRef}>
              <button
                type="button"
                className="user-trigger"
                onClick={() => setDropdownOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                <span className="avatar" aria-hidden="true">
                  {initials(user.name)}
                </span>
                <span className="user-name">{user.name}</span>
              </button>

              {dropdownOpen && (
                <div className="dropdown" role="menu">
                  <div className="dropdown-head">
                    <p className="dropdown-name">{user.name}</p>
                    <p className="dropdown-email">{user.email}</p>
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
            <>
              <Link to="/signin" className="glass-button glass-button--ghost glass-button--sm">
                Sign In
              </Link>
              <Link to="/signup" className="glass-button glass-button--sm">
                Sign Up
              </Link>
            </>
          )}

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
