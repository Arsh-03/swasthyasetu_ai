// One patient conversation (Messages page, patient page tab, meeting side panel). New messages arrive live;
// the thread is marked read while it is on screen.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../components/ui/Icon';
import { cx } from '../components/ui/cx';
import { chatApi, type ChatMessage, type ChatThread } from '../services/doctorApi';
import { usePortal } from './PortalContext';
import { Avatar, ErrorNote, Loading, shortName } from './ui';

export function Conversation({ patientId, compact = false, showHeader = true }: { patientId: string; compact?: boolean; showHeader?: boolean }) {
  const { t, fmt, chatEvent, refreshChatUnread } = usePortal();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(() => new Set());
  const endRef = useRef<HTMLDivElement>(null);

  // Load, and reload on live chat events for this patient.
  useEffect(() => {
    let alive = true;
    chatApi.thread(patientId)
      .then(async (th) => {
        if (!alive) return;
        setThread(th);
        setError(null);
        if (th.messages.some((m) => m.sender === 'patient' && !m.read)) {
          await chatApi.markRead(patientId).catch(() => undefined);
          refreshChatUnread();
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : t('loadError')));
    return () => { alive = false; };
  }, [patientId, chatEvent, t, refreshChatUnread]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await chatApi.send(patientId, body);
      setDraft('');
      setThread((th) => (th ? { ...th, messages: [...th.messages.filter((m) => m.message_id !== msg.message_id), msg], status: { ...th.status, open: true } } : th));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSending(false);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  if (error && !thread) return <ErrorNote message={error} />;
  if (!thread) return <Loading label={t('loading')} />;

  const st = thread.status;
  const banner = st.open
    ? (st.open_until ? t('chatOpenUntil', { date: fmt.dateTime(st.open_until) }) : t('chatOpenConsultation'))
    : t('chatClosedDoctor');

  // Day separators
  let lastDay = '';

  return (
    <div className={cx('flex flex-col min-h-0', compact ? 'h-full' : 'h-full')}>
      {showHeader && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
          <Avatar name={thread.patient.name} src={thread.patient.avatar_url} size={40} />
          <div className="min-w-0 flex-1">
            <a href={`#/patients/${encodeURIComponent(patientId)}`} className="block text-sm font-semibold text-ink truncate hover:underline">{shortName(thread.patient.name)}</a>
            <p className="text-2xs text-ink-muted">{t('writesIn', { lang: thread.patient.language.toUpperCase() })}</p>
          </div>
        </div>
      )}
      <p className={cx('px-4 py-2 text-2xs flex items-center gap-1.5 border-b border-hairline', st.open ? 'text-ink-muted' : 'text-warning-deep bg-warning-tint')}>
        <Icon name={st.open ? 'unlock' : 'lock'} size={12} /> {banner}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2" aria-live="polite">
        {thread.messages.length === 0 && <p className="text-sm text-ink-muted text-center py-8">{t('noMessagesYet')}</p>}
        {thread.messages.map((m) => {
          const day = fmt.dayKey(m.created_at);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.message_id} className="flex flex-col">
              {sep && <p className="text-center text-3xs font-semibold text-ink-muted my-2">{day === fmt.today() ? t('today') : fmt.weekdayLong(day)}</p>}
              <Bubble m={m} original={showOriginal.has(m.message_id)}
                onToggle={() => setShowOriginal((s) => { const n = new Set(s); if (n.has(m.message_id)) n.delete(m.message_id); else n.add(m.message_id); return n; })} />
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-hairline p-3 flex items-end gap-2">
        <label className="flex-1">
          <span className="sr-only">{t('writeMessage')}</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={compact ? 1 : 2}
            maxLength={2000}
            placeholder={t('writeMessage')}
            className="w-full resize-none rounded-control border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary max-h-40"
          />
        </label>
        <button type="button" onClick={() => void send()} disabled={!draft.trim() || sending} aria-label={t('send')} title={t('send')}
          className="w-10 h-10 shrink-0 rounded-control bg-primary text-on-primary flex items-center justify-center cursor-pointer disabled:opacity-40 hover:bg-primary-deep">
          <Icon name="send" size={18} />
        </button>
      </div>
      {error && thread && <p role="alert" className="px-4 pb-2 text-2xs text-danger-deep">{error}</p>}
    </div>
  );
}

function Bubble({ m, original, onToggle }: { m: ChatMessage; original: boolean; onToggle: () => void }) {
  const { t, fmt } = usePortal();
  const mine = m.sender === 'doctor';
  // The doctor reads patient messages in English when a translation exists.
  const showTranslation = !mine && m.translation && !original;
  return (
    <div className={cx('max-w-[85%] flex flex-col', mine ? 'self-end items-end' : 'self-start items-start')}>
      {m.urgent && (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-danger-deep text-white text-3xs font-bold px-2 py-0.5">
          <Icon name="emergency" size={12} /> {t('urgentMessage')}
        </span>
      )}
      <div className={cx('rounded-panel px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
        mine ? 'bg-primary text-on-primary rounded-br-tight' : 'bg-base text-ink rounded-bl-tight border border-hairline',
        m.urgent && 'ring-2 ring-danger')}>
        {showTranslation ? m.translation : m.body}
      </div>
      <span className="mt-0.5 text-3xs text-ink-muted flex items-center gap-1.5">
        {fmt.time(m.created_at)}
        {mine && <span>· {m.read ? t('seen') : t('sent')}</span>}
        {!mine && m.translation && (
          <button type="button" onClick={onToggle} className="text-primary font-semibold hover:underline cursor-pointer">
            {original ? t('showTranslation') : t('showOriginal')}
          </button>
        )}
      </span>
      {m.urgent && !mine && <span className="text-3xs text-danger-deep mt-0.5">{t('urgentMessageHint')}</span>}
    </div>
  );
}
