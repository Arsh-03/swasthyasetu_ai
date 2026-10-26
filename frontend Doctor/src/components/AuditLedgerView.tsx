import React, { useEffect, useState } from 'react';
import { api, type AuditLogEntry } from '../services/api';
import { Icon } from './ui/Icon';
import { type SupportedLanguage, stripNonLatinParentheses } from '../utils/translations';

interface AuditLedgerViewProps {
  selectedLanguage?: SupportedLanguage;
}

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${day} ${month} ${hours}:${mins}:${secs}`;
};

const formatResource = (resId: string, resLabel?: string | null): string => {
  if (!resLabel) return resId;
  const trimmed = resLabel.trim();
  if (trimmed === resId) return resId;
  if (trimmed.startsWith(resId)) return trimmed;
  return `${resId} (${trimmed})`;
};

const cleanAuditString = (raw: string, lang: SupportedLanguage = 'en'): string => {
  if (!raw) return '';
  let str = raw.trim();
  if (lang === 'en') {
    str = stripNonLatinParentheses(str);
  }
  let prev = '';
  while (str !== prev) {
    prev = str;
    // e.g. "usr_x (usr_x (Name))" -> "usr_x (Name)"
    str = str.replace(/^([^()]+?)\s*\(\1\s*\((.*)\)\)$/, '$1 ($2)');
    // e.g. "X (X)" -> "X"
    str = str.replace(/^([^()]+?)\s*\(\1\)$/, '$1');
    // internal repeated token e.g. "usr_x (usr_x)"
    str = str.replace(/\b([a-zA-Z0-9_:-]+)\s*\(\1\)/g, '$1');
  }
  return str.trim();
};

export const AuditLedgerView: React.FC<AuditLedgerViewProps> = ({
  selectedLanguage = 'en',
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setStatus('loading');
    api
      .getAuditLogs()
      .then((rows) => {
        setLogs(rows);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  useEffect(load, []);

  const auditLogs = logs.map((log) => ({
    id: log.event_id,
    timestamp: formatTimestamp(log.timestamp),
    actor: cleanAuditString(log.actor_name || log.actor_id, selectedLanguage),
    action: log.action,
    resource: cleanAuditString(formatResource(log.resource_id, log.resource_label), selectedLanguage),
    purpose: cleanAuditString(log.purpose || '—', selectedLanguage),
    outcome: log.outcome,
    hmacSignature: log.hmac_signature,
  }));

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header with Title and N events count */}
      <div className="pb-3 border-b border-card-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-ink flex items-center justify-center text-white shadow-2xs">
            <Icon name="shieldCheck" size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold font-serif text-ink tracking-tight">
                DPDP Act 2023 Cryptographic Audit Trail
              </h1>
              {logs.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-primary-tint text-primary border border-primary/20">
                  {logs.length} events
                </span>
              )}
            </div>
            <p className="text-[13px] text-ink-muted mt-0.5">
              Immutable, tamper-evident consent access ledger enforced by HMAC tokens and digital signatures.
            </p>
          </div>
        </div>
      </div>

      {/* Table container: table-layout fixed, no horizontal scroll at >=1280px, sticky 1st col below 1024px */}
      <div className="bg-card rounded-xl shadow-2xs border border-card-border overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-230px)] w-full">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[960px] xl:min-w-full">
            <thead className="bg-base text-ink-muted uppercase text-3xs tracking-wider border-b border-card-border sticky top-0 z-20">
              <tr>
                <th className="h-10 px-4 font-semibold whitespace-nowrap w-[150px] min-w-[150px] sticky left-0 z-30 bg-base border-r border-card-border/50 lg:border-r-0">Timestamp</th>
                <th className="h-10 px-3.5 font-semibold whitespace-nowrap w-[180px] xl:w-[22%]">Actor</th>
                <th className="h-10 px-3.5 font-semibold whitespace-nowrap w-[240px] min-w-[240px]">Action</th>
                <th className="h-10 px-3.5 font-semibold whitespace-nowrap w-[210px] xl:w-[26%]">Clinical Resource</th>
                <th className="h-10 px-3.5 font-semibold w-[160px] xl:w-[20%]">Stated Purpose</th>
                <th className="h-10 px-3.5 font-semibold whitespace-nowrap w-[96px] min-w-[96px]">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="h-24 px-4 text-center text-ink-muted">
                    {status === 'loading' && 'Loading audit trail…'}
                    {status === 'ready' && 'No audit events yet.'}
                    {status === 'error' && (
                      <button onClick={load} className="text-primary font-semibold cursor-pointer">
                        Could not load the audit trail. Retry
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-fog/30 transition-colors h-11 group">
                  {/* Timestamp on one line, tabular numbers, sticky on horizontal scroll */}
                  <td
                    className="h-11 px-4 font-mono text-2xs text-ink-muted whitespace-nowrap tabular-nums sticky left-0 z-10 bg-card group-hover:bg-[#F2F5F8] border-r border-card-border/50 lg:border-r-0"
                    title={log.hmacSignature || undefined}
                  >
                    {log.timestamp}
                  </td>
                  {/* Actor column: no wrapping, clean display */}
                  <td className="h-11 px-3.5 font-medium text-ink whitespace-nowrap truncate" title={log.actor}>
                    {log.actor}
                  </td>
                  {/* Action code: quieter (12px mono, no heavy pill) */}
                  <td className="h-11 px-3.5 whitespace-nowrap truncate">
                    <span className="font-mono text-xs text-ink-muted">
                      {log.action}
                    </span>
                  </td>
                  {/* Resource: flexible, may wrap to 2 lines */}
                  <td className="h-11 px-3.5 font-mono text-2xs text-ink-muted leading-tight">
                    <div className="line-clamp-2 break-words" title={log.resource}>
                      {log.resource}
                    </div>
                  </td>
                  {/* Purpose: flexible */}
                  <td className="h-11 px-3.5 text-ink text-xs truncate" title={log.purpose}>
                    {log.purpose}
                  </td>
                  {/* Outcome: ~96px */}
                  <td className="h-11 px-3.5 whitespace-nowrap">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-3xs ${
                        log.outcome === 'SUCCESS'
                          ? 'bg-success-tint text-success-deep'
                          : log.outcome === 'PENDING'
                          ? 'bg-warning-tint text-warning-deep'
                          : 'bg-danger-tint text-danger-deep'
                      }`}
                    >
                      {log.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
