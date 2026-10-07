import type { AuditEvent } from '../types';
import { ShieldCheck, X } from 'lucide-react';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditEvent[];
}

export const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: 'var(--cb-primary)' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                DPDP Act 2023 Cryptographic Audit Trail
              </h2>
              <span className="audit-pill">
                Immutable Hash Log · Tamper Evident
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--cb-text-muted)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--cb-text-muted)', marginBottom: 16 }}>
            Every consent issuance, doctor stream access, patient revocation, and clinical sign-off is hashed and permanently timestamped according to Digital Personal Data Protection Act compliance.
          </p>

          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--cb-text-muted)' }}>
                    No audit records registered yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.event_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      {log.actor_id}
                    </td>
                    <td>
                      <span className="audit-pill" style={{ background: '#f1f5f9' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--cb-text-muted)' }}>
                      {log.resource_id}
                    </td>
                    <td>
                      <span
                        className="badge-status"
                        style={{
                          background: log.outcome === 'SUCCESS' ? '#dcfce7' : log.outcome === 'REVOKED' ? '#fef3c7' : '#fee2e2',
                          color: log.outcome === 'SUCCESS' ? '#166534' : log.outcome === 'REVOKED' ? '#92400e' : '#991b1b',
                          fontSize: '0.7rem'
                        }}
                      >
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} style={{ minHeight: 38 }}>
            Close Trail
          </button>
        </div>
      </div>
    </div>
  );
};
