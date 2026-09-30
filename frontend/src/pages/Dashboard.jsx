import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { Loader } from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { auth as authApi } from '../lib/api';
import { formatBytes, formatDate, relativeTime } from '../lib/format';
import SignInPrompt from '../components/SignInPrompt';
import {
  Archive, Clock, FileImage, FileText, Layers, LogOut, Settings as SettingsIcon,
  ShieldCheck, Sparkle, Zap,
} from '../components/icons';

const TOOLS = [
  {
    to: '/pdf-merger',
    icon: Layers,
    title: 'PDF Merger',
    text: 'Combine as many PDFs as you like into one document, in any order.',
    accent: 'var(--blue)',
  },
  {
    to: '/image-compressor',
    icon: FileImage,
    title: 'Image Compressor',
    text: 'Shrink JPG, PNG and WEBP files with a quality and size target you control.',
    accent: 'var(--purple)',
  },
];

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    document.title = 'Dashboard — NorthStar';
  }, []);

  // An anonymous visitor is offered the sign-in prompt rather than being
  // bounced without explanation.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLoading(false);
  }, [authLoading, isAuthenticated]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await authApi.dashboard();
      setData(payload);
    } catch (err) {
      if (err?.status === 401) {
        // The cookie expired underneath us — treat as signed out.
        error('Your session expired. Please sign in again.');
        return;
      }
      error(err?.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      success('You have been signed out.');
      navigate('/');
    } catch {
      error('Could not sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  if (authLoading) {
    return (
      <div className="page page--top center" style={{ paddingTop: '22vh' }}>
        <Loader text="Checking your session…" size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page page--top page--narrow">
        <Reveal className="page-head">
          <p className="eyebrow">Dashboard</p>
          <h1 className="page-title">Your workspace, once you sign in</h1>
          <p className="page-sub">
            The dashboard tracks how many PDFs you have merged and images you have compressed.
            It is part of the account that also unlocks both tools.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <SignInPrompt />
        </Reveal>
      </div>
    );
  }

  const stats = data?.stats ?? { pdfMerges: 0, imagesCompressed: 0, filesProcessed: 0, bytesSaved: 0 };
  const recent = data?.recent ?? [];

  return (
    <div className="page page--top">
      <Reveal className="dash-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="dash-welcome">
            Welcome, <span className="glow-text">{user.name}</span>
          </h1>
          <p className="dash-sub">
            Member since {formatDate(user.createdAt)}.
            {user.lastLoginAt && ` Last signed in ${relativeTime(user.lastLoginAt)}.`}
          </p>
        </div>
        <div className="row" style={{ gap: 9 }}>
          <Link className="glass-button glass-button--ghost glass-button--sm" to="/account">
            <SettingsIcon style={{ width: 15, height: 15 }} />
            Account
          </Link>
          <button
            type="button"
            className="glass-button glass-button--ghost glass-button--sm"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut style={{ width: 15, height: 15 }} />
            {loggingOut ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      </Reveal>

      {/* ---------------- Stats ---------------- */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--gap)' }}>
        {[
          { label: 'PDF Merges', value: stats.pdfMerges, icon: FileText, hint: 'merge operations run' },
          { label: 'Images Compressed', value: stats.imagesCompressed, icon: FileImage, hint: 'files processed' },
          { label: 'Files Processed', value: stats.filesProcessed, icon: Archive, hint: 'total across both tools' },
          { label: 'Space Saved', value: formatBytes(stats.bytesSaved), icon: Zap, hint: 'output vs. input' },
        ].map((stat, index) => (
          <Reveal key={stat.label} className="glass-card stat-card" delay={index * 60}>
            <span className="stat-head">
              <stat.icon style={{ width: 14, height: 14 }} />
              {stat.label}
            </span>
            <span className="stat-value">{loading ? '—' : stat.value}</span>
            <span className="stat-hint">{stat.hint}</span>
          </Reveal>
        ))}
      </div>

      {/* ---------------- Tools ---------------- */}
      <Reveal className="mb-14">
        <h2 className="section-title" style={{ fontSize: '1.4rem', marginBottom: 6 }}>
          Your tools
        </h2>
        <p className="text-soft text-sm" style={{ marginBottom: 18 }}>
          Anything you run from here is counted on the cards above.
        </p>
      </Reveal>

      <div className="grid grid-2" style={{ marginBottom: 'var(--gap)' }}>
        {TOOLS.map((tool, index) => (
          <Reveal key={tool.to} delay={index * 70}>
            <Link to={tool.to} className="glass-card tool-tile" style={{ height: '100%' }}>
              <span className="feature-icon" style={{ background: `linear-gradient(135deg, ${tool.accent}, #c084fc)` }}>
                <tool.icon />
              </span>
              <h3 className="feature-title" style={{ marginTop: 4 }}>{tool.title}</h3>
              <p className="feature-text">{tool.text}</p>
              <span className="tool-tile-arrow">
                Open {tool.title} <Zap style={{ width: 15, height: 15 }} />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>

      {/* ---------------- Recent activity ---------------- */}
      <Reveal className="glass-panel" delay={80}>
        <div className="row-between mb-20">
          <h2 className="row" style={{ fontSize: '1.15rem', gap: 9 }}>
            <Clock style={{ width: 18, height: 18, color: 'var(--blue)' }} />
            Recent activity
          </h2>
          <span className="text-dim text-sm">Last 8 runs</span>
        </div>

        {loading ? (
          <div className="center" style={{ padding: '30px 0' }}>
            <Loader text="Loading your history…" />
          </div>
        ) : recent.length === 0 ? (
          <div className="empty">
            <span className="empty-icon" aria-hidden="true">
              <Sparkle />
            </span>
            <p style={{ marginBottom: 4 }}>No activity yet.</p>
            <p className="text-dim text-sm">
              Run a merge or a compression and it will show up here.
            </p>
            <div className="action-row">
              <Link className="glass-button glass-button--sm" to="/pdf-merger">Merge PDFs</Link>
              <Link className="glass-button glass-button--ghost glass-button--sm" to="/image-compressor">
                Compress Images
              </Link>
            </div>
          </div>
        ) : (
          <ul className="file-list" style={{ marginTop: 0 }} aria-label="Recent activity">
            {recent.map((row) => {
              const isMerge = row.type === 'pdf-merge';
              const saved = Math.max(0, row.inputBytes - row.outputBytes);
              return (
                <li key={row.id} className="activity-row">
                  <span
                    className="activity-icon"
                    style={{
                      background: isMerge ? 'rgba(56,189,248,0.15)' : 'rgba(168,85,247,0.15)',
                      color: isMerge ? 'var(--blue)' : 'var(--purple)',
                    }}
                    aria-hidden="true"
                  >
                    {isMerge ? <FileText style={{ width: 17, height: 17 }} /> : <FileImage style={{ width: 17, height: 17 }} />}
                  </span>
                  <span className="file-meta">
                    <span className="file-name" style={{ fontSize: '0.88rem' }}>
                      {isMerge ? 'PDF merge' : 'Image compression'} · {row.fileCount} file{row.fileCount === 1 ? '' : 's'}
                    </span>
                    <span className="file-sub">
                      <span>{relativeTime(row.createdAt)}</span>
                      {saved > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>saved {formatBytes(saved)}</span>
                        </>
                      )}
                    </span>
                  </span>
                  {saved > 0 && <span className="saved-badge">−{Math.round((saved / row.inputBytes) * 100)}%</span>}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-dim text-sm mt-26 row" style={{ gap: 8 }}>
          <ShieldCheck style={{ width: 15, height: 15, color: 'var(--cyan)', flexShrink: 0 }} />
          Only counts and byte totals are recorded. Your files are never stored on the server.
        </p>
      </Reveal>
    </div>
  );
}
