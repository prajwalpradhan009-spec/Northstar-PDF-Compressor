import { useEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll wrapper.
 *
 * Adds `.is-in` once the element enters the viewport, which drives the
 * `.fade-in` / `.slide-up` transitions in CSS. Falls back to showing content
 * immediately when IntersectionObserver is unavailable or motion is reduced.
 *
 * The revealed flag is React state rather than a direct `classList` mutation on
 * purpose. `className` belongs to React: if this component imperatively added
 * `is-in` and the parent later re-rendered with a different `className` (an
 * accordion toggling `open`, say), React would overwrite the attribute and drop
 * `is-in` — snapping the element back to `opacity: 0`. Owning the class through
 * state makes the reveal survive any re-render.
 */
export function Reveal({ as: Tag = 'div', variant = 'slide-up', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect(); // reveal once, then stop observing
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${variant}${revealed ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
