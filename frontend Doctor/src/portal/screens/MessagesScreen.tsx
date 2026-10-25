// Messages: conversations with patients (left) and the open conversation (right). On phones, one at a time.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { chatApi, type ChatThreadSummary } from '../../services/doctorApi';
import { usePortal } from '../PortalContext';
import { Conversation } from '../Conversation';
import { hrefFor } from '../router';
import { Avatar, Empty, ErrorNote, Loading, PageHeader, shortName } from '../ui';

export function MessagesScreen({ patientId }: { patientId?: string }) {
  const { t, fmt, chatEvent } = usePortal();
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    let alive = true;
    chatApi.threads().then((r) => { if (alive) { setThreads(r); setError(false); } }).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [chatEvent, patientId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (threads ?? []).filter((th) =>
      (!q || th.name.toLowerCase().includes(q)) && (!onlyActive || th.last_message || th.other_id === patientId));
  }, [threads, query, onlyActive, patientId]);

  return (
    <>
      <PageHeader title={t('navMessages')} subtitle={t('messagesSubtitle')} />
      {error && <ErrorNote message={t('loadError')} />}
      {!threads && !error && <Loading label={t('loading')} />}
      {threads && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 h-[calc(100vh-13rem)] min-h-[480px]">
          <section className={cx('bg-card rounded-panel border border-hairline flex flex-col min-h-0', patientId && 'hidden lg:flex')}>
            <div className="p-3 border-b border-hairline flex flex-col gap-2">
              <label className="relative">
                <span className="sr-only">{t('searchPatients')}</span>
                <Icon name="search" size={16} tone="muted" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPatients')}
                  className="w-full h-9 rounded-control border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                <input type="checkbox" checked={!onlyActive} onChange={(e) => setOnlyActive(!e.target.checked)} className="accent-(--color-primary)" />
                {t('showAllPatients')}
              </label>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-hairline">
              {shown.length === 0 && <li><Empty icon="chat" title={t('noConversations')}>{t('noConversationsHint')}</Empty></li>}
              {shown.map((th) => {
                const active = th.other_id === patientId;
                return (
                  <li key={th.other_id}>
                    <a href={hrefFor({ page: 'messages', patientId: th.other_id })} aria-current={active ? 'page' : undefined}
                      className={cx('flex items-center gap-3 px-3 py-3 hover:bg-base', active && 'bg-primary-tint')}>
                      <Avatar name={th.name} src={th.avatar_url} size={40} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={cx('text-sm text-ink truncate flex-1', th.unread ? 'font-bold' : 'font-semibold')}>{shortName(th.name)}</span>
                          {th.last_message && <span className="text-3xs text-ink-muted shrink-0">{fmt.dayKey(th.last_message.created_at) === fmt.today() ? fmt.time(th.last_message.created_at) : fmt.date(th.last_message.created_at)}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={cx('text-xs truncate flex-1', th.unread ? 'text-ink' : 'text-ink-muted')}>
                            {th.last_message ? `${th.last_message.sender === 'doctor' ? `${t('you')}: ` : ''}${th.last_message.translation && th.last_message.sender === 'patient' ? th.last_message.translation : th.last_message.body}` : t('noMessagesYet')}
                          </span>
                          {th.urgent && <Icon name="emergency" size={14} tone="danger" label={t('urgentMessage')} />}
                          {th.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-3xs font-bold flex items-center justify-center">{th.unread}</span>}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className={cx('bg-card rounded-panel border border-hairline min-h-0 flex-col', patientId ? 'flex' : 'hidden lg:flex')}>
            {patientId ? (
              <>
                <a href="#/messages" className="lg:hidden flex items-center gap-1 px-4 pt-3 text-xs font-semibold text-primary"><Icon name="chevronLeft" size={14} /> {t('navMessages')}</a>
                <Conversation key={patientId} patientId={patientId} />
              </>
            ) : (
              <Empty icon="chat" title={t('pickConversation')} />
            )}
          </section>
        </div>
      )}
    </>
  );
}
