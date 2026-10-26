// Single-series column chart (counts per day). One hue (primary), thin columns with a 4px rounded top,
// recessive grid, hover/focus tooltip per column, and a screen-reader table with the same numbers.
import { useEffect, useId, useRef, useState } from 'react';

export interface BarDatum { key: string; label: string; tooltip: string; value: number; highlight?: boolean }

export function BarChart({ data, title, height = 150, valueLabel }: {
  data: BarDatum[]; title: string; height?: number; valueLabel: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  // Drawn at its real pixel width, so text and the chart height stay the same on phones and wide screens.
  const box = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = { top: 12, right: 4, bottom: 24, left: 26 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  // A "nice" top: the next whole step above the max, with at most 3 grid lines.
  const step = Math.max(1, Math.ceil(max / 3));
  const top = step * Math.ceil(max / step);
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(24, band - 2)); // never fill the band; ≥2px air between columns
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = data.length > 10 || band < 34 ? 2 : 1;
  const active = hover !== null ? data[hover] : null;

  return (
    <figure ref={box} className="relative m-0" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="sr-only">{title}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block" role="img" aria-label={title}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tk)} y2={y(tk)}
              stroke="var(--color-hairline)" strokeWidth={tk === 0 ? 1 : 1} strokeDasharray={tk === 0 ? undefined : '2 3'} />
            <text x={pad.left - 6} y={y(tk)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">{tk}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const x = cx - barW / 2;
          const r = Math.min(4, barW / 2, h);
          // Rounded data end (top), square at the baseline.
          const path = h <= 0 ? '' :
            `M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${y(0)} Z`;
          return (
            <g key={d.key}>
              {/* Hit target: the whole band, taller than the mark */}
              <rect x={pad.left + band * i} y={pad.top} width={band} height={plotH}
                fill={hover === i ? 'var(--color-ink-tint)' : 'transparent'}
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                tabIndex={0} aria-label={d.tooltip} role="img" />
              {path && <path d={path} fill="var(--color-primary)" opacity={d.highlight === false ? 0.45 : 1} pointerEvents="none" />}
              {i % labelEvery === 0 && (
                <text x={cx} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full bg-night text-white text-2xs rounded-tight px-2 py-1 shadow-md whitespace-nowrap"
          style={{
            left: `${((pad.left + band * hover + band / 2) / width) * 100}%`,
            top: `${(y(active.value) / height) * 100}%`,
            marginTop: -6,
          }}
        >
          <span className="font-semibold">{valueLabel(active.value)}</span> · {active.tooltip}
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => <tr key={d.key}><th scope="row">{d.tooltip}</th><td>{valueLabel(d.value)}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}
