// The AI notepad as a floating window over the meeting: drag it by its title bar, resize from the corner,
// minimise to a chip. It stays mounted while hidden, so typing and AI minutes are never lost.
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';

const KEY = 'notepad_window_v3';

interface Box { x: number; y: number; w: number; h: number }

function initialBox(): Box {
  // Right side, below the top bar, ending above the call's control bar.
  const w = Math.min(560, window.innerWidth - 32);
  const h = Math.max(280, Math.min(600, window.innerHeight - 80 - 150));
  const fallback = { x: window.innerWidth - w - 24, y: 80, w, h };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Box | null;
    return saved ? clamp(saved) : fallback;
  } catch {
    return fallback;
  }
}

function clamp(b: Box): Box {
  const w = Math.min(Math.max(320, b.w), window.innerWidth - 16);
  const h = Math.min(Math.max(240, b.h), window.innerHeight - 16);
  return { w, h, x: Math.min(Math.max(8, b.x), window.innerWidth - w - 8), y: Math.min(Math.max(8, b.y), window.innerHeight - h - 8) };
}

export function FloatingNotepad({ open, onClose, title, minimizeLabel, closeLabel, children }: {
  open: boolean; onClose: () => void; title: string; minimizeLabel: string; closeLabel: string; children: ReactNode;
}) {
  const [box, setBox] = useState<Box>(initialBox);
  const [minimized, setMinimized] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(box)); } catch { /* private mode */ }
  }, [box]);
  useEffect(() => {
    const onResize = () => setBox((b) => clamp(b));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // The browser's resize handle changes the element's size; keep it in state so it is remembered.
  useEffect(() => {
    const el = bodyRef.current?.parentElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (drag.current) return;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 100) return; // hidden or minimised
      setBox((b) => (Math.abs(b.w - r.width) > 2 || Math.abs(b.h - r.height) > 2 ? { ...b, w: r.width, h: r.height } : b));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, minimized]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - box.x, dy: e.clientY - box.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setBox((b) => clamp({ ...b, x: e.clientX - drag.current!.dx, y: e.clientY - drag.current!.dy }));
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <>
      {open && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed bottom-6 right-6 z-[55] inline-flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-border shadow-lg text-sm font-semibold text-ink cursor-pointer"
        >
          <Icon name="notepad" size={18} tone="primary" weight="duotone" /> {title}
        </button>
      )}
      <section
        aria-label={title}
        hidden={!open || minimized}
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        className="fixed z-[55] bg-card rounded-panel border border-border shadow-2xl flex flex-col overflow-hidden resize min-w-[320px] min-h-[240px]"
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={cx('h-11 shrink-0 flex items-center gap-2 pl-3 pr-1.5 border-b border-hairline bg-base select-none cursor-move touch-none')}
        >
          <Icon name="drag" size={16} tone="muted" />
          <Icon name="notepad" size={18} tone="primary" weight="duotone" />
          <span className="text-sm font-semibold text-ink flex-1 truncate">{title}</span>
          <button type="button" onClick={() => setMinimized(true)} aria-label={minimizeLabel} title={minimizeLabel}
            className="w-8 h-8 rounded-tight flex items-center justify-center text-ink-muted hover:bg-ink-tint cursor-pointer">
            <Icon name="chevronDown" size={16} />
          </button>
          <button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel}
            className="w-8 h-8 rounded-tight flex items-center justify-center text-ink-muted hover:bg-ink-tint cursor-pointer">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto p-3">{children}</div>
      </section>
    </>
  );
}
