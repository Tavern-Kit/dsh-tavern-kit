import React, { useLayoutEffect, useRef, useState } from 'react';

export interface OverflowLineProps {
  as?: 'span' | 'div';
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export function OverflowLine({ as: Tag = 'span', children, className, label }: OverflowLineProps): React.ReactElement {
  const scrollRef = useRef<HTMLSpanElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const overflowing = edges.start || edges.end;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    let active = true;
    function measure() {
      if (!active || !element) return;
      const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
      const position = Math.max(0, Math.min(element.scrollLeft, maximum));
      const fits = element.clientWidth === 0 || maximum <= 1;
      const next = { start: !fits && position > 1, end: !fits && maximum - position > 1 };
      setEdges(previous => previous.start === next.start && previous.end === next.end ? previous : next);
    }
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    if (observer) observer.observe(element);
    else window.addEventListener('resize', measure);
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', measure);
    void fonts?.ready.then(measure);
    return () => {
      active = false;
      element.removeEventListener('scroll', measure);
      fonts?.removeEventListener('loadingdone', measure);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', measure);
    };
  }, [children, Tag]);
  return <Tag className={`tk-overflow-line${className ? ` ${className}` : ''}`} data-overflow-start={edges.start || undefined} data-overflow-end={edges.end || undefined}>
    <span ref={scrollRef} className="tk-overflow-scroll" tabIndex={overflowing ? 0 : undefined} role={label ? 'region' : undefined} aria-label={label}>{children}</span>
  </Tag>;
}
