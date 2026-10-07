import React, { useState, useEffect } from 'react';
import {
  UserPlus, Sparkles, Send, CheckCircle2,
  XCircle, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { authFetch } from '../services/apiClient';

interface LinkPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientLinked: (patientData: any, grantToken: string) => void;
}

export const LinkPatientModal: React.FC<LinkPatientModalProps> = ({
  isOpen,
  onClose,
  onPatientLinked
}) => {
  const [abhaIdentifier, setAbhaIdentifier] = useState('aarav.patel@abdm');
  const [purpose, setPurpose] = useState('Evaluating clinical symptoms, past medical history & diagnostic records');
  const [durationMinutes] = useState(60);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'waiting_otp' | 'approved' | 'rejected'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConsentId, setPendingConsentId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setErrorMessage(null);
      setPendingConsentId(null);
    }
  }, [isOpen]);

  // Listen for WebSocket notifications when in waiting_otp state
  useEffect(() => {
    if (!isOpen || status !== 'waiting_otp') return;

    let socket: WebSocket | null = null;
    let pollInterval: any = null;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/telehealth`);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ABHA_LINK_APPROVED' && (data.consent_id === pendingConsentId || !pendingConsentId)) {
            setStatus('approved');
            setTimeout(() => {
              onPatientLinked(data, data.grant_token);
              onClose();
            }, 1200);
          } else if (data.type === 'ABHA_LINK_REJECTED') {
            setStatus('rejected');
            setErrorMessage('Patient declined the link request.');
          }
        } catch {}
      };
    } catch {}

    // Fallback polling every 2.5s in case WebSocket drops
    pollInterval = setInterval(async () => {
      if (!pendingConsentId) return;
      try {
        const res = await authFetch(`/api/v1/auth/patient/${abhaIdentifier}/details`);
        if (res.ok) {
          // If we can fetch without 404, check audit/consent status
        }
      } catch {}
    }, 2500);

    return () => {
      if (socket) socket.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, status, pendingConsentId, abhaIdentifier, onPatientLinked, onClose]);

  if (!isOpen) return null;

  const handleSendRequest = async () => {
    if (!abhaIdentifier.trim()) {
      setErrorMessage('Please enter an ABHA Address or ABHA Number.');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    try {
      const res = await authFetch('/api/v1/consents/link-patient-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abha_identifier: abhaIdentifier.trim(),
          purpose: purpose.trim(),
          duration_minutes: durationMinutes,
          scopes: ['demographics', 'medical_history', 'diagnostic_records']
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPendingConsentId(data.consent_id);
        setStatus('waiting_otp');
      } else {
        const err = await res.json();
        setErrorMessage(err.detail || 'Failed to dispatch ABHA Link Request.');
        setStatus('idle');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Network error connecting to ABDM Gateway.');
      setStatus('idle');
    }
  };

  const handleSimulateQuickGrant = async () => {
    // Demo speed-run button in case testing without opening another tab
    if (!pendingConsentId) return;
    try {
      const res = await authFetch(`/api/v1/consents/${pendingConsentId}/verify-otp-and-grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp_code: '789456'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatus('approved');
        setTimeout(() => {
          onPatientLinked(data, data.grant_token);
          onClose();
        }, 800);
      }
    } catch {}
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              padding: 10,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
            }}>
              <UserPlus size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--cb-text-main)', margin: 0 }}>
                Link Patient via ABHA ID
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span className="audit-pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                  ABDM HIU Gateway · DPDP Act 2023
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '6px 10px', minHeight: 'auto', borderRadius: 8 }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {status === 'waiting_otp' ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                position: 'relative'
              }}>
                <Loader2 size={36} color="#4f46e5" className="animate-spin" />
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                Awaiting Patient Authorization & OTP
              </h3>

              <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.5 }}>
                An ABDM Consent Request has been pushed to the patient linked with <strong>{abhaIdentifier}</strong>.
                The patient must accept the request and verify with their 6-digit Aadhaar/ABHA OTP.
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                textAlign: 'left',
                fontSize: '0.84rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Target ABHA:</span>
                  <span style={{ fontWeight: 700, color: '#1e40af' }}>{abhaIdentifier}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Consent Purpose:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Clinical Review & Records Access</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Status:</span>
                  <span style={{ fontWeight: 700, color: '#d97706' }}>⏳ Dispatched · Waiting for Patient OTP</span>
                </div>
              </div>

              {/* Demo accelerator shortcut */}
              <button
                type="button"
                className="btn btn-outline"
                style={{
                  fontSize: '0.82rem',
                  padding: '8px 14px',
                  borderColor: '#818cf8',
                  color: '#4338ca',
                  background: '#eef2ff'
                }}
                onClick={handleSimulateQuickGrant}
              >
                <Sparkles size={14} />
                <span>Simulate Patient Accepting & Entering OTP (Demo Shortcut)</span>
              </button>
            </div>
          ) : status === 'approved' ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#dcfce7',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <CheckCircle2 size={40} color="#16a34a" />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#166534', marginBottom: 8 }}>
                Consent Granted & Verified!
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: 12 }}>
                Patient verified the OTP and signed the ABDM Consent Artifact.
                Ephemeral cryptographic HMAC token generated in vault.
              </p>
              <div style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem' }}>
                Unlocking medical history and health records now...
              </div>
            </div>
          ) : status === 'rejected' ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <XCircle size={40} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', marginBottom: 8 }}>
                Access Request Declined
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: 16 }}>
                The patient declined the consent request. Under the DPDP Act 2023, access to their ABHA records is strictly blocked.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStatus('idle')}
              >
                Try Another Patient
              </button>
            </div>
          ) : (
            <div>
              {errorMessage && (
                <div style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  color: '#b91c1c',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16
                }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ABHA Identifier Input */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 6
                }}>
                  Patient ABHA Address / 14-Digit ABHA ID <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={abhaIdentifier}
                    onChange={(e) => setAbhaIdentifier(e.target.value)}
                    placeholder="e.g. aarav.patel@abdm, 91-4820-1928-1120@abdm"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Quick preset chips */}
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: 6 }}>
                    Quick Select Active Demo Patients:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    <button
                      type="button"
                      style={{
                        padding: '4px 9px',
                        background: abhaIdentifier === 'aarav.patel@abdm' ? '#e0e7ff' : '#f1f5f9',
                        border: '1px solid',
                        borderColor: abhaIdentifier === 'aarav.patel@abdm' ? '#6366f1' : '#e2e8f0',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: '#1e293b'
                      }}
                      onClick={() => setAbhaIdentifier('aarav.patel@abdm')}
                    >
                      👤 Aarav Patel (aarav.patel@abdm)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '4px 9px',
                        background: abhaIdentifier === '91-4820-1928-1120@abdm' ? '#e0e7ff' : '#f1f5f9',
                        border: '1px solid',
                        borderColor: abhaIdentifier === '91-4820-1928-1120@abdm' ? '#6366f1' : '#e2e8f0',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: '#1e293b'
                      }}
                      onClick={() => setAbhaIdentifier('91-4820-1928-1120@abdm')}
                    >
                      👤 Ramesh Gowda (91-4820-1928-1120@abdm)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '4px 9px',
                        background: abhaIdentifier === '91-5555-8888-9999@abdm' ? '#e0e7ff' : '#f1f5f9',
                        border: '1px solid',
                        borderColor: abhaIdentifier === '91-5555-8888-9999@abdm' ? '#6366f1' : '#e2e8f0',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: '#1e293b'
                      }}
                      onClick={() => setAbhaIdentifier('91-5555-8888-9999@abdm')}
                    >
                      👤 Basavaraj Patil (91-5555-8888-9999@abdm)
                    </button>
                  </div>
                </div>
              </div>

              {/* Clinical Purpose */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 6
                }}>
                  Clinical Purpose of Access (Mandatory under DPDP Act 2023)
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    color: '#0f172a',
                    marginBottom: 8,
                    background: '#ffffff'
                  }}
                >
                  <option value="Evaluating clinical symptoms, past medical history & diagnostic records">
                    Evaluating clinical symptoms, past medical history & diagnostic records
                  </option>
                  <option value="Routine tele-consultation, chronic disease review & prescription renewal">
                    Routine tele-consultation, chronic disease review & prescription renewal
                  </option>
                  <option value="Acute flank pain triage, Ultrasound scan review & DDI safety analysis">
                    Acute flank pain triage, Ultrasound scan review & DDI safety analysis
                  </option>
                  <option value="Emergency clinical consultation & care plan formulation">
                    Emergency clinical consultation & care plan formulation
                  </option>
                </select>
              </div>

              {/* Scopes & Duration */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Requested Access Scopes:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.82rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b', fontWeight: 600 }}>
                    <input type="checkbox" checked readOnly style={{ accentColor: '#4f46e5' }} />
                    Demographics Profile
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b', fontWeight: 600 }}>
                    <input type="checkbox" checked readOnly style={{ accentColor: '#4f46e5' }} />
                    Medical History & Diagnoses
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b', fontWeight: 600 }}>
                    <input type="checkbox" checked readOnly style={{ accentColor: '#4f46e5' }} />
                    Active Medications & Allergies
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b', fontWeight: 600 }}>
                    <input type="checkbox" checked readOnly style={{ accentColor: '#4f46e5' }} />
                    Diagnostic Records & Scans
                  </label>
                </div>
                <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} />
                  <span>Validity: 60 minutes · Single-use HMAC cryptographic token</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '14px 20px', gap: 10 }}>
          {status === 'idle' && (
            <>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, minHeight: 44 }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  flex: 2,
                  minHeight: 44,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  gap: 8,
                  fontSize: '0.92rem',
                  fontWeight: 700
                }}
                onClick={handleSendRequest}
              >
                <Send size={16} />
                <span>Request ABHA Consent & Access</span>
              </button>
            </>
          )}

          {status === 'requesting' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled
              style={{ width: '100%', minHeight: 44 }}
            >
              <Loader2 size={16} className="animate-spin" />
              <span>Dispatching to ABDM Gateway...</span>
            </button>
          )}

          {status === 'waiting_otp' && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', minHeight: 44 }}
              onClick={onClose}
            >
              Close (Request Running in Background)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
