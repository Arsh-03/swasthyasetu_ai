import React, { useEffect, useState } from 'react';
import { api, type AuditLogEntry } from '../services/api';

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const AuditLedgerView: React.FC = () => {
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
    actor: log.actor_name || log.actor_id,
    action: log.action,
    resource: log.resource_label ? `${log.resource_id} (${log.resource_label})` : log.resource_id,
    purpose: log.purpose || '—',
    outcome: log.outcome,
    hmacSignature: log.hmac_signature,
  }));

  return (
    <div className="w-full max-w-6xl mx-auto px-5 lg:px-8 py-6 flex flex-col gap-6">
      <div className="pb-4 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white shadow-apple-sm">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1C1C1E] tracking-tight">DPDP Act 2023 Cryptographic Audit Trail</h2>
            <p className="text-xs text-[#8E8E93] mt-0.5">
              Immutable, tamper-evident consent access ledger enforced by HMAC tokens and digital signatures.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-apple-sm border border-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2F2F7] text-[#8E8E93] uppercase text-[10px] tracking-wider border-b border-black/5">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp (UTC+5:30)</th>
                <th className="py-3 px-4 font-semibold">Actor & Credentials</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Clinical Resource</th>
                <th className="py-3 px-4 font-semibold">Stated Purpose</th>
                <th className="py-3 px-4 font-semibold">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-[#8E8E93]">
                    {status === 'loading' && 'Loading audit trail…'}
                    {status === 'ready' && 'No audit events yet.'}
                    {status === 'error' && (
                      <button onClick={load} className="text-[#007AFF] font-semibold">
                        Could not load the audit trail. Retry
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F2F2F7]/60 transition-colors">
                  <td
                    className="py-3 px-4 font-mono text-[11px] text-[#8E8E93]"
                    title={log.hmacSignature || undefined}
                  >
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#1C1C1E]">{log.actor}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] font-semibold text-[#1C1C1E] bg-[#F2F2F7] px-2 py-0.5 rounded border border-black/5">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#636366]">{log.resource}</td>
                  <td className="py-3 px-4 text-[#1C1C1E]">{log.purpose}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                        log.outcome === 'SUCCESS'
                          ? 'bg-[#34C759]/15 text-[#248A3D]'
                          : log.outcome === 'PENDING'
                          ? 'bg-[#FF9500]/15 text-[#FF9500]'
                          : 'bg-[#FF3B30]/15 text-[#FF3B30]'
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
