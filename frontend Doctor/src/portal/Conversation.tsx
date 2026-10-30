// One patient conversation (Messages page, patient page tab, meeting side panel). New messages arrive live;
// the thread is marked read while it is on screen. The doctor can add emojis and react to patient messages.
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  // Close the emoji picker on an outside click or Escape.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => { if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false); };
    const onEsc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setPickerOpen(false); inputRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc); };
  }, [pickerOpen]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await chatApi.send(patientId, body);
      setDraft('');
      setPickerOpen(false);
      setError(null);
      setThread((th) => (th ? { ...th, messages: [...th.messages.filter((m) => m.message_id !== msg.message_id), msg], status: { ...th.status, open: true } } : th));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter is a new line. Skip while a Kannada/Hindi keyboard is still composing a word.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  // Put an emoji where the cursor is.
  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    setDraft((draft.slice(0, start) + emoji + draft.slice(end)).slice(0, 2000));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  // Set my reaction (the same emoji again removes it). Shown at once, undone if saving fails.
  const react = async (m: ChatMessage, emoji: string) => {
    const before = m.reactions ?? {};
    const next = before.doctor === emoji ? null : emoji;
    const apply = (r: ChatMessage['reactions']) =>
      setThread((th) => (th ? { ...th, messages: th.messages.map((x) => (x.message_id === m.message_id ? { ...x, reactions: r } : x)) } : th));
    const after = { ...before };
    if (next) after.doctor = next; else delete after.doctor;
    apply(after);
    try {
      const saved = await chatApi.react(patientId, m.message_id, next);
      apply(saved.reactions ?? {});
    } catch (e) {
      apply(before);
      setError(e instanceof Error ? e.message : t('saveError'));
    }
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
              <Bubble m={m} original={showOriginal.has(m.message_id)} onReact={(emoji) => void react(m, emoji)}
                onToggle={() => setShowOriginal((s) => { const n = new Set(s); if (n.has(m.message_id)) n.delete(m.message_id); else n.add(m.message_id); return n; })} />
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Right padding keeps the send button clear of CHIBI in the bottom-right corner. */}
      <div className="border-t border-hairline p-3 pr-16 flex items-end gap-2">
        <div ref={pickerRef} className="relative shrink-0">
          <button type="button" onClick={() => setPickerOpen((o) => !o)} aria-label={t('addEmoji')} title={t('addEmoji')} aria-expanded={pickerOpen}
            className={cx('w-10 h-10 rounded-control flex items-center justify-center cursor-pointer text-ink-muted hover:bg-ink-tint hover:text-ink', pickerOpen && 'bg-ink-tint text-ink')}>
            <Icon name="emoji" size={20} />
          </button>
          {pickerOpen && (
            <div role="dialog" aria-label={t('addEmoji')}
              className="absolute bottom-12 left-0 z-20 w-[284px] rounded-panel bg-card border border-hairline shadow-sheet p-2 grid grid-cols-8 gap-0.5">
              {QUICK_EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => insertEmoji(e)} aria-label={e}
                  className="w-8 h-8 rounded-control text-lg leading-none flex items-center justify-center hover:bg-ink-tint cursor-pointer">{e}</button>
              ))}
            </div>
          )}
        </div>
        <label className="flex-1">
          <span className="sr-only">{t('writeMessage')}</span>
          <textarea
            ref={inputRef}
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
          className="w-10 h-10 shrink-0 rounded-control bg-primary text-on-primary flex items-center justify-center cursor-pointer shadow-sm hover:bg-primary-deep disabled:bg-primary-soft disabled:shadow-none disabled:cursor-not-allowed">
          <Icon name="send" size={18} />
        </button>
      </div>
      {error && thread && <p role="alert" className="px-4 pb-2 text-2xs text-danger-deep">{error}</p>}
    </div>
  );
}

function Bubble({ m, original, onToggle, onReact }: { m: ChatMessage; original: boolean; onToggle: () => void; onReact: (emoji: string) => void }) {
  const { t, fmt } = usePortal();
  const mine = m.sender === 'doctor';
  // The doctor reads patient messages in English when a translation exists.
  const showTranslation = !mine && m.translation && !original;
  // Urgent messages get no quick reactions: a thumbs-up must never stand in for a clinical reply.
  const canReact = !mine && !m.urgent;
  const myReaction = m.reactions?.doctor;
  const theirReaction = m.reactions?.patient;
  return (
    <div className={cx('group max-w-[85%] flex flex-col', mine ? 'self-end items-end' : 'self-start items-start')}>
      {m.urgent && (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-danger-deep text-white text-3xs font-bold px-2 py-0.5">
          <Icon name="emergency" size={12} /> {t('urgentMessage')}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div className={cx('rounded-panel px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
          mine ? 'bg-primary text-on-primary rounded-br-tight' : 'bg-base text-ink rounded-bl-tight border border-hairline',
          m.urgent && 'ring-2 ring-danger')}>
          {showTranslation ? m.translation : m.body}
        </div>
        {canReact && (
          <div role="group" aria-label={t('react')}
            className="shrink-0 flex items-center gap-0.5 rounded-full bg-card border border-hairline shadow-sm px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {smartReactions(`${m.body} ${m.translation ?? ''}`).map((e) => (
              <button key={e} type="button" onClick={() => onReact(e)} aria-label={`${t('react')} ${e}`} aria-pressed={myReaction === e}
                className={cx('w-7 h-7 rounded-full text-base leading-none flex items-center justify-center cursor-pointer hover:bg-ink-tint hover:scale-110 transition-transform',
                  myReaction === e && 'bg-primary-tint')}>{e}</button>
            ))}
          </div>
        )}
      </div>
      {(myReaction || theirReaction) && (
        <div className={cx('-mt-1.5 relative flex gap-1', mine ? 'mr-2' : 'ml-2')}>
          {theirReaction && (
            <span title={t('patientReaction')} className="rounded-full bg-card border border-hairline shadow-sm px-1.5 py-0.5 text-sm leading-none">{theirReaction}</span>
          )}
          {myReaction && (
            <button type="button" onClick={() => onReact(myReaction)} title={t('yourReaction')} aria-label={t('yourReaction')}
              className="rounded-full bg-card border border-primary-soft shadow-sm px-1.5 py-0.5 text-sm leading-none cursor-pointer hover:bg-ink-tint">{myReaction}</button>
          )}
        </div>
      )}
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

const QUICK_EMOJIS = [
  '👍', '🙏', '😊', '❤️', '✅', '👋', '💪', '🙂',
  '👏', '🤝', '💊', '💧', '🩺', '🌡️', '🛌', '🥗',
  '🚶', '⏰', '📅', '📞', '⚠️', '❗', '👀', '💙',
];

// Reactions that fit what the patient wrote (English, Kannada, Hindi and romanised), best first.
const REACTION_RULES: { re: RegExp; emojis: string[] }[] = [
  { re: /thank|thanks|thx|ಧನ್ಯವಾದ|धन्यवाद|शुक्रिया|dhanyavad|shukriya/i, emojis: ['🙏', '😊', '❤️'] },
  { re: /better|improv|fine|good|okay|\bok\b|relief|ಕಡಿಮೆ ಆಗಿದೆ|ಚೆನ್ನಾಗಿ|ಸರಿ|ठीक|बेहतर|आराम|accha|theek/i, emojis: ['👍', '💪', '😊'] },
  { re: /pain|hurt|fever|worr|scared|dizzy|vomit|ನೋವು|ಜ್ವರ|ಭಯ|दर्द|बुखार|चिंता|डर|novu|dard/i, emojis: ['💙', '👀', '🙏'] },
  { re: /\d{2,3}\s*\/\s*\d{2,3}|sugar|\bbp\b|reading|report|ಶುಗರ್|ರಿಪೋರ್ಟ್|शुगर|रिपोर्ट/i, emojis: ['✅', '👀', '👍'] },
  { re: /[?？]/, emojis: ['👀', '👍', '✅'] },
];
const DEFAULT_REACTIONS = ['👍', '🙏', '✅', '❤️', '😊'];

function smartReactions(text: string): string[] {
  const picked: string[] = [];
  for (const r of REACTION_RULES) if (r.re.test(text)) picked.push(...r.emojis);
  return [...new Set([...picked, ...DEFAULT_REACTIONS])].slice(0, 5);
}
