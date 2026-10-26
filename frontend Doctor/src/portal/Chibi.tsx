// CHIBI in the doctor portal: the assistant's face in the corner, on every page.
// In a consultation it is the AI IntelliSense: it listens quietly, keeps what was said but isn't in the note
// ready (also shown as grey hints in the note), and turns red for danger signs. Elsewhere it offers shortcuts.
// Other features plug in as skills (registerChibiSkill), e.g. the accessibility / navigation work.
import { useEffect, useState } from 'react';
import { ChibiFace, type ChibiMood } from '../components/chibi/ChibiFace';
import { Icon, type IconName } from '../components/ui/Icon';
import { usePortal } from './PortalContext';
import { navigate, type Route } from './router';

export interface ChibiSkill {
  id: string;
  label: string;
  icon: IconName;
  /** Shown only when this returns true (e.g. only outside a consultation). */
  when?: (ctx: { route: Route; inConsultation: boolean }) => boolean;
  run: () => void;
}

const skills: ChibiSkill[] = [];
const listeners = new Set<() => void>();

/** Add a CHIBI skill from any feature (returns a function that removes it). */
export function registerChibiSkill(skill: ChibiSkill): () => void {
  skills.push(skill);
  listeners.forEach(l => l());
  return () => {
    const i = skills.indexOf(skill);
    if (i >= 0) skills.splice(i, 1);
    listeners.forEach(l => l());
  };
}

export function Chibi({ route }: { route: Route }) {
  const { call, consultation, unread, chatUnread, addToNote } = usePortal();
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => { const l = () => bump(n => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  useEffect(() => setOpen(false), [route]);

  const listening = call.aiState === 'recording';
  const inConsultation = !!consultation && (call.callState === 'connected' || listening || route.page === 'meeting');
  const heard = (call.minutes?.missing ?? []);
  const alerts = call.assist.alerts;
  const mood: ChibiMood = alerts.length ? 'alert' : call.aiState === 'finishing' ? 'thinking'
    : listening ? (heard.length ? 'hint' : 'listening') : 'idle';
  const badge = alerts.length || (inConsultation ? heard.length : 0) || (!inConsultation ? chatUnread + unread : 0);
  const extra = skills.filter(s => !s.when || s.when({ route, inConsultation }));

  const status = alerts.length ? 'Danger sign heard'
    : listening ? (heard.length ? `${heard.length} thing(s) said that aren't in your note` : 'Listening quietly')
      : inConsultation ? 'AI minutes are off' : 'Hi, I’m CHIBI';

  return (
    <div className="fixed bottom-5 right-5 z-[55] flex flex-col items-end gap-2">
      {open && (
        <div role="dialog" aria-label="CHIBI" className="w-[min(340px,calc(100vw-2.5rem))] max-h-[60vh] overflow-y-auto rounded-panel bg-card shadow-sheet border border-hairline p-4">
          <p className="text-sm font-bold text-ink">{status}</p>
          <p className="text-xs text-ink-muted mb-3">Central Health Informatics Bot Interface</p>

          {alerts.slice(0, 2).map(a => (
            <div key={a.id} className="mb-2 rounded-control bg-danger-tint px-3 py-2">
              <p className="text-sm font-bold text-danger-deep">{a.title}</p>
              <p className="text-xs text-ink">{a.detail}</p>
            </div>
          ))}

          {inConsultation && heard.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted mt-1 mb-1">Heard, not in your note</p>
              <ul className="flex flex-col gap-1.5 mb-2">
                {heard.slice(0, 5).map(f => (
                  <li key={f.id} className="flex items-start gap-2 text-sm">
                    <span className="flex-1">{f.text} <span className="text-2xs text-ink-muted">· {f.heading ?? f.section}</span></span>
                    <button type="button" className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      onClick={() => addToNote({ id: f.id, text: f.text, section: f.section, heading: f.heading })}>+ Add</button>
                  </li>
                ))}
              </ul>
              <p className="text-2xs text-ink-muted">They also show as grey text on an empty line under the right heading. Tab adds one.</p>
            </>
          )}

          {!inConsultation && (
            <div className="flex flex-col gap-1">
              <SkillButton icon="aiAssist" label="Try me in the Test Lab" onClick={() => navigate({ page: 'lab' })} />
              {chatUnread > 0 && <SkillButton icon="chat" label={`${chatUnread} unread message(s)`} onClick={() => navigate({ page: 'messages' })} />}
              {unread > 0 && <SkillButton icon="history" label={`${unread} new notification(s)`} onClick={() => navigate({ page: 'audit' })} />}
            </div>
          )}
          {extra.length > 0 && (
            <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-hairline">
              {extra.map(s => <SkillButton key={s.id} icon={s.icon} label={s.label} onClick={s.run} />)}
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        aria-label={`CHIBI: ${status}`} title={status}
        className="rounded-full bg-card shadow-lg p-1.5 hover:scale-105 transition-transform cursor-pointer">
        <ChibiFace mood={mood} size={52} badge={badge || undefined} />
      </button>
    </div>
  );
}

function SkillButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 rounded-control px-2.5 py-2 text-sm text-ink hover:bg-ink-tint text-left cursor-pointer">
      <Icon name={icon} size={16} /> {label}
    </button>
  );
}
