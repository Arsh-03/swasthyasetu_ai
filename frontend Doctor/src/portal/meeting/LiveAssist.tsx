// Live assistant during the call: which engine is running, suggestions as they stream in, and safety alerts.
// Nothing goes into the note without the doctor's click.
import { Icon, type IconName } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import type { AssistAlert, AssistSuggestion } from '../../services/call/callTypes';
import { usePortal } from '../PortalContext';
import type { StringKey } from '../i18n';

const KIND: Record<string, { label: StringKey; icon: IconName; tone: string; section: string | null; prefix: string }> = {
  ASK: { label: 'assistAsk', icon: 'chat', tone: 'bg-primary-tint text-primary', section: null, prefix: '' },
  CHECK: { label: 'assistCheck', icon: 'vitals', tone: 'bg-ice text-primary-deep', section: 'exam', prefix: 'Check: ' },
  NOTE: { label: 'assistNote', icon: 'clinicalNotes', tone: 'bg-success-tint text-success-deep', section: 'history', prefix: '' },
  SAFETY: { label: 'assistSafety', icon: 'drugAlert', tone: 'bg-warning-tint text-warning-deep', section: 'plan', prefix: 'Safety: ' },
};

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

export function LiveAssist() {
  const { t, call, addToNote } = usePortal();
  const a = call.assist;
  if (!call.aiOn && a.suggestions.length === 0 && !a.streaming) {
    return (
      <div className="mb-3 rounded-control border border-dashed border-border px-3 py-2 text-xs text-ink-muted flex items-center gap-2">
        <Icon name="aiAssist" size={16} /> {t('assistOff')}
      </div>
    );
  }
  const add = (s: AssistSuggestion) => {
    const k = KIND[s.kind] ?? KIND.NOTE;
    addToNote({ id: `assist_${s.id}`, text: `${k.prefix}${s.text}`, section: k.section ?? 'history' });
    call.dismissSuggestion(s.id);
  };
  return (
    <section aria-label={t('assistTitle')} className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 border-b border-primary/30 bg-card p-2.5 shadow-xs max-h-[45%] overflow-y-auto">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Icon name="aiAssist" size={16} weight="duotone" /> {t('assistTitle')}</span>
        <EngineBadges />
      </div>
      {a.streaming && (
        <p className="text-xs text-ink whitespace-pre-wrap bg-card rounded-tight px-2.5 py-2 mb-2" aria-live="polite">
          {a.streaming}<span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 align-middle animate-pulse" />
        </p>
      )}
      {a.suggestions.length === 0 && !a.streaming && <p className="text-xs text-ink-muted px-1">{t('assistListening')}</p>}
      <ul className="flex flex-col gap-1.5">
        {a.suggestions.map((s) => {
          const k = KIND[s.kind] ?? KIND.NOTE;
          return (
            <li key={s.id} className="bg-card rounded-tight px-2.5 py-2 flex items-start gap-2">
              <span className={cx('shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-3xs font-bold', k.tone)}>
                <Icon name={k.icon} size={11} /> {t(k.label)}
              </span>
              <span className="flex-1 text-xs text-ink">{s.text}</span>
              {k.section && (
                <button type="button" onClick={() => add(s)} className="shrink-0 text-3xs font-bold text-primary hover:underline cursor-pointer">
                  + {t('addToNote')}
                </button>
              )}
              <button type="button" onClick={() => call.dismissSuggestion(s.id)} aria-label={t('dismiss')}
                className="shrink-0 text-ink-muted hover:text-ink cursor-pointer"><Icon name="close" size={12} /></button>
            </li>
          );
        })}
      </ul>
      <p className="text-3xs text-ink-muted mt-2 px-1">{t('assistPrivacy')}</p>
    </section>
  );
}

/** Safety alerts as pop-ups (shown over the video, so they are seen even with the notepad closed). */
export function AlertStack() {
  const { t, call, addToNote } = usePortal();
  const alerts = call.assist.alerts.slice(0, 3);
  if (alerts.length === 0) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] flex flex-col gap-2" aria-live="assertive">
      {alerts.map((a: AssistAlert) => (
        <div key={a.id} role="alert" className="rounded-control bg-card border-2 border-danger shadow-xl p-3">
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
