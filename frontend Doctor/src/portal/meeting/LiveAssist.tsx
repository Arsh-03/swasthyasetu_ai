// Live assistant during the call, kept quiet on purpose: a one-line status (is the AI listening, which engines),
// short "Noted: ..." toasts when something new is understood, and pop-ups only for safety alerts.
// The AI's help with writing comes as autocomplete inside the notepad (it sees the masked conversation).
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import type { AssistAlert } from '../../services/call/callTypes';
import { usePortal } from '../PortalContext';

/** Engine badges: your own model (live) or the built-in demo engine. */
export function EngineBadges() {
  const { t, call } = usePortal();
  const a = call.assist;
  if (!call.aiOn && !a.speech) return null;
  const badge = (label: string, engine: 'live' | 'demo' | null) => engine && (
    <span title={engine === 'live' ? t('engineLiveHint') : t('engineDemoHint')}
      className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-bold',
        engine === 'live' ? 'bg-success-tint text-success-deep' : 'bg-warning-tint text-warning-deep')}>
      <span className={cx('w-1.5 h-1.5 rounded-full', engine === 'live' ? 'bg-success' : 'bg-warning')} />
      {label}: {engine === 'live' ? t('engineLive') : t('engineDemo')}
    </span>
  );
  return <span className="flex flex-wrap gap-1">{badge(t('engineSpeech'), a.speech)}{badge(t('engineSuggestions'), a.model)}</span>;
}

/** One line above the notes: listening or not, which engines, practice. */
export function AssistStrip() {
  const { t, call } = usePortal();
  if (!call.aiOn) {
    return (
      <p className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
        <Icon name="aiAssist" size={14} /> {t('assistOffShort')}
      </p>
    );
  }
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        {call.practice ? (call.practiceVoice ? t('practiceListeningVoice') : t('practiceListeningDemo')) : t('assistListeningShort')}
      </span>
      {call.practice && <span className="rounded-full bg-warning-tint text-warning-deep text-3xs font-bold px-2 py-0.5">{t('practiceBadge')}</span>}
      <EngineBadges />
      <span className="text-ink-muted">{t('assistAutocompleteHint')}</span>
    </div>
  );
}

/** "Noted: fever for 3 days" toasts for each new thing the AI picked up from the conversation. */
export function NotedToasts() {
  const { t, call } = usePortal();
  const seen = useRef<Set<string>>(new Set());
  const [queue, setQueue] = useState<{ id: string; text: string }[]>([]);
  const minutes = call.minutes?.minutes;

  useEffect(() => {
    if (!minutes) return;
    const fresh: { id: string; text: string }[] = [];
    for (const items of Object.values(minutes)) {
      for (const text of items) {
        const id = text.toLowerCase();
        if (seen.current.has(id)) continue;
        seen.current.add(id);
        fresh.push({ id, text: text.replace(/\s*\(patient-reported\)\.?$/i, '').replace(/\.$/, '') });
      }
    }
    if (fresh.length) setQueue((q) => [...q, ...fresh].slice(-4));
  }, [minutes]);

  // One at a time, each for a few seconds.
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setQueue((q) => q.slice(1)), 3500);
    return () => clearTimeout(id);
  }, [current]);

  if (!current) return null;
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[58] max-w-[min(520px,calc(100vw-2rem))] flex items-center gap-2 rounded-full bg-night/90 text-white text-sm px-4 py-2 shadow-lg">
      <Icon name="aiAssist" size={16} />
      <span className="font-semibold">{t('noted')}:</span>
      <span className="truncate">{current.text}</span>
      {queue.length > 1 && <span className="text-ice text-2xs">+{queue.length - 1}</span>}
    </div>
  );
}

/** Safety alerts as pop-ups (over everything, so they are seen even with the notes open). */
/** Danger signs heard in the call. `inline`: a quiet strip above the notes instead of a floating pop-up. */
export function AlertStack({ inline = false }: { inline?: boolean } = {}) {
  const { t, call, addToNote } = usePortal();
  const alerts = call.assist.alerts.slice(0, inline ? 2 : 3);
  if (alerts.length === 0) return null;
  return (
    <div className={inline ? 'flex flex-col gap-2 mb-2' : 'fixed top-20 left-1/2 -translate-x-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] flex flex-col gap-2'}
      aria-live="assertive">
      {alerts.map((a: AssistAlert) => (
        <div key={a.id} role="alert" className={inline ? 'rounded-control bg-danger-tint border border-danger/40 px-3 py-2' : 'rounded-control bg-card border-2 border-danger shadow-lg p-3'}>
          <p className="flex items-center gap-1.5 text-sm font-bold text-danger-deep">
            <Icon name={a.kind === 'allergy' ? 'drugAlert' : 'emergency'} size={18} /> {a.title}
          </p>
          <p className="text-xs text-ink mt-1">{a.detail}</p>
          {a.quote && <p className="text-2xs text-ink-muted mt-1 italic">“{a.quote}”{a.quote_english && a.quote_english !== a.quote ? ` (${a.quote_english})` : ''}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-3xs text-ink-muted">{a.source}</span>
            <span className="flex gap-3">
              {a.kind === 'red_flag' && (
                <button type="button" className="text-2xs font-bold text-primary hover:underline cursor-pointer"
                  onClick={() => { addToNote({ id: `alert_${a.id}`, text: `${a.title}: ${a.quote_english || a.quote}`.trim(), section: 'complaints' }); call.dismissAlert(a.id); }}>
                  + {t('addToNote')}
                </button>
              )}
              <button type="button" onClick={() => call.dismissAlert(a.id)} className="text-2xs font-bold text-ink-muted hover:text-ink cursor-pointer">{t('dismiss')}</button>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
