/**
 * The animated nebula behind every page.
 *
 * Five large blurred clouds drift on GPU-friendly transforms, plus a small
 * fixed set of particles. The whole layer is `pointer-events: none` (set in
 * CSS) so it can never intercept a click, and the particle count is
 * deterministic — a fixed table, not Math.random() per render, so React
 * re-renders never reshuffle or multiply them.
 */

const CLOUDS = [
  { className: 'cloud cloud--1' },
  { className: 'cloud cloud--2 cloud--even' },
  { className: 'cloud cloud--3' },
  { className: 'cloud cloud--4 cloud--even' },
  { className: 'cloud cloud--5' },
];

/* x/y are viewport percentages; duration/delay are seconds. */
const PARTICLES = [
  { x: 6, y: 74, dx: 60, dy: -180, dur: 22, delay: 0, size: 3, peak: 0.7, tint: 'rgba(56,189,248,0.9)' },
  { x: 14, y: 32, dx: -40, dy: -220, dur: 27, delay: 3, size: 2, peak: 0.55, tint: 'rgba(165,243,252,0.9)' },
  { x: 22, y: 88, dx: 75, dy: -150, dur: 25, delay: 6, size: 4, peak: 0.5, tint: 'rgba(129,140,248,0.9)' },
  { x: 31, y: 18, dx: 50, dy: -200, dur: 30, delay: 1.5, size: 2, peak: 0.6, tint: 'rgba(255,255,255,0.9)' },
  { x: 38, y: 62, dx: -65, dy: -170, dur: 24, delay: 8, size: 3, peak: 0.45, tint: 'rgba(192,132,252,0.9)' },
  { x: 45, y: 95, dx: 40, dy: -140, dur: 28, delay: 4, size: 2, peak: 0.65, tint: 'rgba(34,211,238,0.9)' },
  { x: 52, y: 44, dx: 80, dy: -190, dur: 26, delay: 9, size: 3, peak: 0.5, tint: 'rgba(224,231,255,0.9)' },
  { x: 58, y: 8, dx: -45, dy: -210, dur: 31, delay: 2, size: 2, peak: 0.55, tint: 'rgba(56,189,248,0.9)' },
  { x: 64, y: 79, dx: 55, dy: -160, dur: 23, delay: 11, size: 4, peak: 0.4, tint: 'rgba(167,243,208,0.9)' },
  { x: 70, y: 26, dx: -70, dy: -185, dur: 29, delay: 5, size: 3, peak: 0.6, tint: 'rgba(196,181,253,0.9)' },
  { x: 76, y: 91, dx: 45, dy: -145, dur: 27, delay: 13, size: 2, peak: 0.5, tint: 'rgba(125,211,252,0.9)' },
  { x: 82, y: 54, dx: 65, dy: -175, dur: 25, delay: 7, size: 3, peak: 0.45, tint: 'rgba(255,255,255,0.9)' },
  { x: 88, y: 16, dx: -50, dy: -205, dur: 32, delay: 10, size: 2, peak: 0.65, tint: 'rgba(129,140,248,0.9)' },
  { x: 93, y: 68, dx: 60, dy: -165, dur: 26, delay: 14, size: 3, peak: 0.5, tint: 'rgba(34,211,238,0.9)' },
  { x: 10, y: 52, dx: -35, dy: -155, dur: 33, delay: 16, size: 2, peak: 0.4, tint: 'rgba(216,180,254,0.9)' },
  { x: 48, y: 34, dx: 35, dy: -175, dur: 30, delay: 18, size: 2, peak: 0.5, tint: 'rgba(224,231,255,0.9)' },
  { x: 66, y: 4, dx: -55, dy: -150, dur: 28, delay: 20, size: 3, peak: 0.45, tint: 'rgba(56,189,248,0.9)' },
  { x: 96, y: 36, dx: 45, dy: -195, dur: 29, delay: 22, size: 2, peak: 0.5, tint: 'rgba(165,243,252,0.9)' },
];

export default function CloudBackground() {
  return (
    <div className="nebula" aria-hidden="true">
      {CLOUDS.map((cloud) => (
        <div key={cloud.className} className={cloud.className} />
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
