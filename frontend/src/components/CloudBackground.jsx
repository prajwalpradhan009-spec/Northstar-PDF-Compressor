import { useEffect, useRef } from 'react';

/**
 * The premium animated atmosphere behind every page.
 *
 * Layered, back to front:
 *   1. Deep midnight-navy / rich cosmic galaxy base
 *   2. Fine drifting digital grid
 *   3. Huge blurred aurora fields (cyan / blue / violet)
 *   4. Ambient glow cloud orbs (reacting with parallax to scroll)
 *   5. Realistic billowing cloud formations that drift & morph on scroll
 *   6. Sleek light trails
 *   7. Glowing motes / particles
 *
 * All animations are transform/opacity only, GPU accelerated, and pointer-events: none.
 */

const CLOUDS = [
  { className: 'cloud cloud--1', scrollFactor: 0.18, scrollXFactor: 0.08 },
  { className: 'cloud cloud--2 cloud--even', scrollFactor: -0.22, scrollXFactor: -0.12 },
  { className: 'cloud cloud--3', scrollFactor: 0.26, scrollXFactor: 0.1 },
  { className: 'cloud cloud--4 cloud--even', scrollFactor: -0.15, scrollXFactor: -0.06 },
  { className: 'cloud cloud--5', scrollFactor: 0.2, scrollXFactor: 0.14 },
];

const BEAMS = ['beam beam--1', 'beam beam--2', 'beam beam--3'];

/* x/y are viewport percentages; duration/delay are seconds. */
const PARTICLES = [
  { x: 6, y: 74, dx: 60, dy: -180, dur: 22, delay: 0, size: 3, peak: 0.7, tint: 'rgba(0,207,255,0.9)' },
  { x: 14, y: 32, dx: -40, dy: -220, dur: 27, delay: 3, size: 2, peak: 0.55, tint: 'rgba(165,243,252,0.9)' },
  { x: 22, y: 88, dx: 75, dy: -150, dur: 25, delay: 6, size: 4, peak: 0.5, tint: 'rgba(99,102,241,0.9)' },
  { x: 31, y: 18, dx: 50, dy: -200, dur: 30, delay: 1.5, size: 2, peak: 0.6, tint: 'rgba(255,255,255,0.9)' },
  { x: 38, y: 62, dx: -65, dy: -170, dur: 24, delay: 8, size: 3, peak: 0.45, tint: 'rgba(168,85,247,0.9)' },
  { x: 45, y: 95, dx: 40, dy: -140, dur: 28, delay: 4, size: 2, peak: 0.65, tint: 'rgba(34,211,238,0.9)' },
  { x: 52, y: 44, dx: 80, dy: -190, dur: 26, delay: 9, size: 3, peak: 0.5, tint: 'rgba(224,231,255,0.9)' },
  { x: 58, y: 8, dx: -45, dy: -210, dur: 31, delay: 2, size: 2, peak: 0.55, tint: 'rgba(0,207,255,0.9)' },
  { x: 64, y: 79, dx: 55, dy: -160, dur: 23, delay: 11, size: 4, peak: 0.4, tint: 'rgba(167,243,208,0.9)' },
  { x: 70, y: 26, dx: -70, dy: -185, dur: 29, delay: 5, size: 3, peak: 0.6, tint: 'rgba(192,132,252,0.9)' },
  { x: 76, y: 91, dx: 45, dy: -145, dur: 27, delay: 13, size: 2, peak: 0.5, tint: 'rgba(125,211,252,0.9)' },
  { x: 82, y: 54, dx: 65, dy: -175, dur: 25, delay: 7, size: 3, peak: 0.45, tint: 'rgba(255,255,255,0.9)' },
  { x: 88, y: 16, dx: -50, dy: -205, dur: 32, delay: 10, size: 2, peak: 0.65, tint: 'rgba(99,102,241,0.9)' },
  { x: 93, y: 68, dx: 60, dy: -165, dur: 26, delay: 14, size: 3, peak: 0.5, tint: 'rgba(0,207,255,0.9)' },
  { x: 10, y: 52, dx: -35, dy: -155, dur: 33, delay: 16, size: 2, peak: 0.4, tint: 'rgba(216,180,254,0.9)' },
  { x: 48, y: 34, dx: 35, dy: -175, dur: 30, delay: 18, size: 2, peak: 0.5, tint: 'rgba(224,231,255,0.9)' },
  { x: 66, y: 4, dx: -55, dy: -150, dur: 28, delay: 20, size: 3, peak: 0.45, tint: 'rgba(0,207,255,0.9)' },
  { x: 96, y: 36, dx: 45, dy: -195, dur: 29, delay: 22, size: 2, peak: 0.5, tint: 'rgba(165,243,252,0.9)' },
];

export default function CloudBackground() {
  const containerRef = useRef(null);

  useEffect(() => {
    let rafId = null;
    const container = containerRef.current;
    if (!container) return undefined;

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const maxScroll = Math.max(
          (document.documentElement.scrollHeight || 1) - window.innerHeight,
          1,
        );
        const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);

        container.style.setProperty('--scroll-y', `${scrollY}px`);
        container.style.setProperty('--scroll-progress', progress.toFixed(4));
        container.style.setProperty('--scroll-cloud-1-x', `${(scrollY * 0.12).toFixed(1)}px`);
        container.style.setProperty('--scroll-cloud-1-y', `${(scrollY * -0.2).toFixed(1)}px`);
        container.style.setProperty('--scroll-cloud-2-x', `${(scrollY * -0.15).toFixed(1)}px`);
        container.style.setProperty('--scroll-cloud-2-y', `${(scrollY * -0.32).toFixed(1)}px`);
        container.style.setProperty('--scroll-cloud-3-x', `${(scrollY * 0.22).toFixed(1)}px`);
        container.style.setProperty('--scroll-cloud-3-y', `${(scrollY * -0.14).toFixed(1)}px`);
        container.style.setProperty('--scroll-cloud-scale', (1 + progress * 0.18).toFixed(3));

        rafId = null;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Trigger once on mount
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} className="nebula" aria-hidden="true">
      <div className="nebula-grid" />

      <div className="aurora aurora--1" />
      <div className="aurora aurora--2" />
      <div className="aurora aurora--3" />

      {/* Ambient glow orbs with scroll parallax */}
      {CLOUDS.map((cloud, idx) => (
        <div
          key={cloud.className}
          className={cloud.className}
          style={{
            '--s-factor-y': cloud.scrollFactor,
            '--s-factor-x': cloud.scrollXFactor,
          }}
        />
      ))}

      {/* Billowing Atmospheric Cloud Formations that respond directly to scroll */}
      <div className="scroll-cloud-layer scroll-cloud-layer--1">
        <svg
          viewBox="0 0 1600 480"
          fill="none"
          preserveAspectRatio="none"
          className="billowing-svg"
        >
          <defs>
            <linearGradient id="cloud-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#19D9FF" stopOpacity="0.14" />
              <stop offset="45%" stopColor="#1769FF" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#8057FF" stopOpacity="0.12" />
            </linearGradient>
            <filter id="cloud-blur-1" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="35" />
            </filter>
          </defs>
          <path
            d="M-50,300 C80,210 220,240 320,290 C420,180 580,160 690,240 C800,150 960,170 1060,250 C1180,160 1340,190 1440,280 C1540,210 1650,260 1700,320 L1700,480 L-50,480 Z"
            fill="url(#cloud-grad-1)"
            filter="url(#cloud-blur-1)"
          />
        </svg>
      </div>

      <div className="scroll-cloud-layer scroll-cloud-layer--2">
        <svg
          viewBox="0 0 1600 520"
          fill="none"
          preserveAspectRatio="none"
          className="billowing-svg"
        >
          <defs>
            <linearGradient id="cloud-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8057FF" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#19D9FF" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#20E3A2" stopOpacity="0.07" />
            </linearGradient>
            <filter id="cloud-blur-2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="40" />
            </filter>
          </defs>
          <path
            d="M-40,360 C120,260 280,290 380,340 C490,220 670,210 790,300 C920,210 1100,230 1210,320 C1330,220 1500,260 1650,360 L1650,520 L-40,520 Z"
            fill="url(#cloud-grad-2)"
            filter="url(#cloud-blur-2)"
          />
        </svg>
      </div>

      {BEAMS.map((beam) => (
        <div key={beam} className={beam} />
      ))}

      <div className="particles">
        {PARTICLES.map((p, index) => (
          <span
            key={index}
            className="particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
              '--size': `${p.size}px`,
              '--peak': p.peak,
              '--tint': p.tint,
            }}
          />
        ))}
      </div>
    </div>
  );
}
