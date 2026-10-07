import React, { useState, useEffect } from 'react';
import type { Language, ConsentRequest } from '../types';
import { translations } from '../translations';
import {
  ShieldAlert, Volume2, CheckCircle2, XCircle, Clock, Eye,
  AlertTriangle, KeyRound, Sparkles, ShieldCheck
} from 'lucide-react';

interface ConsentModalProps {
  isOpen: boolean;
  request: ConsentRequest | null;
  language: Language;
  isRepresentative: boolean;
  onDecision: (approved: boolean, otpCode?: string) => void;
  onPlayAudio: (text: string) => void;
  isPlayingAudio: boolean;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  request,
  language,
  isRepresentative,
  onDecision,
  onPlayAudio,
  isPlayingAudio
}) => {
  const [otpCode, setOtpCode] = useState('789456');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOtpCode('789456');
      setOtpError(null);
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const t = translations[language];

  const handleApproveWithOtp = () => {
    const clean = otpCode.trim();
    if (!clean || clean.length < 4) {
      setOtpError('Please enter the valid 6-digit OTP code received on your mobile.');
      return;
    }
    setOtpError(null);
    setIsVerifying(true);
    onDecision(true, clean);
  };

  const handleDecline = () => {
    onDecision(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: 560 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#ffffff',
              padding: 10,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
            }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--cb-text-main)', margin: 0 }}>
                {t.modalTitle}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span className="audit-pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                  ABDM Purpose Gate · DPDP Act 2023 §6
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`btn-audio ${isPlayingAudio ? 'playing' : ''}`}
            onClick={() => onPlayAudio(t.consentAudioText)}
            title="Listen to consent explanation"
          >
            <Volume2 size={16} />
            <span>{t.listenAudioBtn}</span>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {isRepresentative && (
            <div className="clinical-alert clinical-alert-warning" style={{ fontSize: '0.82rem', marginBottom: 14 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Authorised Representative Action:</strong> You are granting legal proxy consent on behalf of patient Ramesh Gowda as registered representative (Sunita Devi).
              </div>
            </div>
          )}

          <div className="clinical-alert clinical-alert-warning" style={{ marginBottom: 14 }}>
            <Clock size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>{t.modalHeaderNotice}</strong>
            </div>
          </div>

          {/* Requesting Clinician Details */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            fontSize: '0.88rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px 12px' }}>
              <span style={{ color: 'var(--cb-text-muted)', fontWeight: 600 }}>Data Fiduciary:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>
                {request.practitioner_name || 'Dr. Ananya Sharma, MD (Telemedicine Physician)'}
              </span>

              <span style={{ color: 'var(--cb-text-muted)', fontWeight: 600 }}>NMC Reg No:</span>
              <span style={{ fontWeight: 700, color: '#2563eb' }}>
                {request.practitioner_reg || 'NMC-KA-581920 (Verified Registry)'}
              </span>

              <span style={{ color: 'var(--cb-text-muted)', fontWeight: 600 }}>{t.purposeLabel}</span>
              <span style={{ fontWeight: 600, color: '#334155' }}>{request.purpose}</span>

              <span style={{ color: 'var(--cb-text-muted)', fontWeight: 600 }}>{t.durationLabel}</span>
              <span style={{ fontWeight: 700, color: '#d97706' }}>
                60 Minutes (Auto-expiring cryptographic HMAC token in vault)
              </span>

              <span style={{ color: 'var(--cb-text-muted)', fontWeight: 600 }}>{t.scopeLabel}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#059669' }}>
                <Eye size={14} /> Demographics, Medical History & Diagnostic Scans (Stream-Only)
              </span>
            </div>
          </div>

          {/* OTP Based Cryptographic Signature Section */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1.5px solid #86efac',
            borderRadius: 14,
            padding: 18,
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                background: '#16a34a',
                color: '#ffffff',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <KeyRound size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#166534', margin: 0 }}>
                  Aadhaar / ABHA OTP Signature Verification
                </h4>
                <span style={{ fontSize: '0.78rem', color: '#15803d' }}>
                  Mandatory cryptographic verification under DPDP Act 2023 §6
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#166534', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Enter the 6-digit OTP sent to your registered mobile (<strong>+91 98••• ••345</strong>) to cryptographically sign this consent artifact.
            </p>

            {otpError && (
              <div style={{
                padding: '8px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                color: '#b91c1c',
                fontSize: '0.82rem',
                marginBottom: 10
              }}>
                {otpError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '2px solid #86efac',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="button"
                className="btn btn-outline"
                style={{
                  padding: '9px 12px',
                  fontSize: '0.8rem',
                  borderColor: '#16a34a',
                  color: '#166534',
                  background: '#ffffff',
                  gap: 6
                }}
                onClick={() => setOtpCode('789456')}
              >
                <Sparkles size={14} color="#16a34a" />
                <span>⚡ Auto-fill Demo OTP</span>
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: '0.74rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={14} />
              <span>Sign will generate an ephemeral HMAC-SHA256 token valid for 60 minutes.</span>
            </div>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--cb-text-muted)', lineHeight: 1.5, margin: 0 }}>
            {t.dpdpDisclaimer}
          </p>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '14px 20px', gap: 12 }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ flex: 1, minHeight: 46, fontSize: '0.92rem', color: '#dc2626', borderColor: '#fca5a5' }}
            onClick={handleDecline}
            disabled={isVerifying}
          >
            <XCircle size={18} />
            <span>{t.declineBtn}</span>
          </button>

          <button
            type="button"
            className="btn btn-success"
            style={{
              flex: 1.5,
              minHeight: 46,
              fontSize: '0.95rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              gap: 8,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
            }}
            onClick={handleApproveWithOtp}
            disabled={isVerifying}
          >
            <CheckCircle2 size={18} />
            <span>{isVerifying ? 'Verifying OTP & Signing...' : 'Verify OTP & Grant Access'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
