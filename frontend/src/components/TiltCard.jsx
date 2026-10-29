import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 3D Interactive Tilt & Specular Glare Card Component.
 *
 * Dynamically tracks cursor motion to tilt the element in 3D perspective space,
 * moving an illuminated specular glare reflection across the surface and
 * allowing child elements with `transform: translateZ(...)` to pop out with
 * real physical depth.
 *
 * Fully GPU-accelerated via CSS custom properties and handles reduced motion.
 */
export default function TiltCard({
  children,
  className = '',
  maxTilt = 10,
  glare = true,
  perspective = 1200,
  as: Tag = 'div',
  style = {},
  ...rest
}) {
  const cardRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafId = useRef(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (e) => setReducedMotion(e.matches);
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      if (reducedMotion || !cardRef.current) return;
      const el = cardRef.current;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const px = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const py = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);

      const tiltX = (py - 0.5) * -maxTilt * 2;
      const tiltY = (px - 0.5) * maxTilt * 2;

      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        el.style.setProperty('--tilt-rx', `${tiltX.toFixed(2)}deg`);
        el.style.setProperty('--tilt-ry', `${tiltY.toFixed(2)}deg`);
        el.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
        el.style.setProperty('--glare-o', '1');
      });
    },
    [maxTilt, reducedMotion],
  );

  const handlePointerLeave = useCallback(() => {
    if (reducedMotion || !cardRef.current) return;
    const el = cardRef.current;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      el.style.setProperty('--tilt-rx', '0deg');
      el.style.setProperty('--tilt-ry', '0deg');
      el.style.setProperty('--glare-o', '0');
    });
  }, [reducedMotion]);

  return (
    <Tag
      ref={cardRef}
      className={`tilt-card-wrap ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        perspective: `${perspective}px`,
        ...style,
      }}
      {...rest}
    >
      <div className="tilt-card-inner">
        {glare && <div className="tilt-card-glare" aria-hidden="true" />}
        {children}
      </div>
    </Tag>
  );
}
