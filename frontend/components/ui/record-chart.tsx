'use client';
import { useEffect, useRef } from 'react';
declare global { interface Window { Charts?: any } }
export function RecordChart({ labels, values, label, horizontal = false, height = 190, money = false }: { labels: string[]; values: number[]; label: string; horizontal?: boolean; height?: number; money?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false; let observer: ResizeObserver | undefined; let frame = 0; let lastWidth = 0;
    const draw = () => {
      const el = ref.current; if (!el || !window.Charts || cancelled) return;
      el.replaceChildren();
      if (horizontal) window.Charts.barList(el, labels.map((text, i) => ({ label: text, value: values[i] })), { thin: true });
      else window.Charts.bars(el, { labels, values, height, colour: getComputedStyle(el).getPropertyValue('--chart-1').trim(), integerTicks: !money, format: (n: number) => money ? `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}` : String(n) });
      const svg = el.querySelector('svg'); if (svg) svg.setAttribute('aria-label', label);
    };
    const resize = () => { const width = Math.round(ref.current?.clientWidth || 0); if (cancelled || width <= 0 || width === lastWidth) return; lastWidth = width; cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    import('@/app/lib/charts-engine.js').then(async () => { await document.fonts.ready; if (!cancelled) { observer = new ResizeObserver(resize); if (ref.current) observer.observe(ref.current); resize(); } });
    return () => { cancelled = true; cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [labels.join('|'), values.join('|'), label, horizontal, height, money]);
  return <div className="record-chart" ref={ref} role="img" aria-label={label}><span className="sr-only">{labels.map((text, i) => `${text}: ${values[i]}`).join('; ')}</span></div>;
}
