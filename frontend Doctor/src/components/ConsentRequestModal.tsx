import React, { useEffect, useId, useRef, useState } from 'react';
import type { PatientSummary, RecordSummary } from '../services/api';
import { api } from '../services/api';
import { Icon } from './ui/Icon';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { type SupportedLanguage, formatLocalizedName, stripNonLatinParentheses } from '../utils/translations';

interface ConsentRequestModalProps {
  patient: PatientSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedLanguage?: SupportedLanguage;
}

export const ConsentRequestModal: React.FC<ConsentRequestModalProps> = ({
  patient,
  isOpen,
  onClose,
  onSuccess,
  selectedLanguage = 'en',
}) => {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [recordsStatus, setRecordsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedRecord, setSelectedRecord] = useState('');
  const [clinicalPurpose, setClinicalPurpose] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load this patient's ABDM records whenever the modal opens
  useEffect(() => {
    if (!isOpen || !patient) return;
    let cancelled = false;
    setRecordsStatus('loading');
    setError(null);
    setClinicalPurpose(patient.complaint ? `Clinical evaluation of: ${patient.complaint}` : '');
    api
      .getPatientRecords(patient.patient_id)
      .then((rows) => {
        if (cancelled) return;
        setRecords(rows);
        // Default to the first record the doctor cannot see yet
        const firstLocked = rows.find((r) => r.consent_status !== 'approved') || rows[0];
        setSelectedRecord(firstLocked ? firstLocked.record_id : '');
        setRecordsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setRecordsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, patient?.patient_id]);

  // Keyboard: focus moves in, Tab is trapped, Esc closes, focus returns to the opener
  const dialogRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  useDialogA11y(isOpen && !!patient, dialogRef, onClose);

  if (!isOpen || !patient) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.requestConsent({
        patient_id: patient.patient_id,
        encounter_id: patient.encounter_id,
        record_id: selectedRecord,
        purpose: clinicalPurpose,
        duration_minutes: durationMinutes,
      });
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the consent request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-night/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="w-full max-w-lg bg-card rounded-2xl shadow-lg border border-card-border p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-card-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-ink flex items-center justify-center text-white shadow-sm">
              <Icon name="key" size={20} />
            </div>
            <div className="flex flex-col">
              <h3 id={`${uid}-title`} className="text-lg font-bold text-ink tracking-tight">DPDP Consent Request</h3>
              <span className="text-2xs text-ink-muted">Digital Personal Data Protection Act 2023 Gate</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full bg-fog/70 hover:bg-fog text-ink flex items-center justify-center transition-colors ring-1 ring-card-border active:scale-95 cursor-pointer"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {sentSuccess ? (
          <div role="status" className="py-6 flex flex-col items-center justify-center gap-2.5 text-center">
            <div className="w-14 h-14 rounded-full bg-success/15 text-success-deep flex items-center justify-center animate-bounce">
              <Icon name="send" size={30} />
            </div>
            <h4 className="text-lg font-bold text-ink tracking-tight">Push Notification Dispatched</h4>
            <p className="text-xs text-ink-muted max-w-xs leading-relaxed">
              A high-priority OTP verification modal has been sent via WebSockets to {formatLocalizedName(patient.full_name, selectedLanguage)}'s mobile device.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Target Patient Info */}
            <div className="p-3 rounded-xl bg-base flex items-center justify-between border border-card-border">
              <div className="flex flex-col">
                <span className="text-3xs font-semibold text-ink-muted uppercase">Subject Data Principal</span>
                <span className="text-sm font-semibold text-ink">{formatLocalizedName(patient.full_name, selectedLanguage)}</span>
              </div>
              <span className="text-xs font-mono font-semibold text-primary bg-primary-tint px-2.5 py-0.5 rounded-full">
                {patient.abha_address}
              </span>
            </div>

            {/* Target Health Record (white fill, 1px #728A97 border, 2px focus ring) */}
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-record`} className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">Requested Record Artifact</label>
              <select
                id={`${uid}-record`}
                value={selectedRecord}
                onChange={(e) => setSelectedRecord(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-card border border-[#728A97] text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              >
                {recordsStatus === 'loading' && <option value="">Loading records…</option>}
                {recordsStatus === 'error' && <option value="">Could not load records</option>}
                {recordsStatus === 'ready' && records.length === 0 && (
                  <option value="">No ABDM records linked for this patient</option>
                )}
                {records.map((r) => (
                  <option key={r.record_id} value={r.record_id}>
                    {stripNonLatinParentheses(r.title)} ({r.date_str}){r.consent_status === 'approved' ? ' — access active' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Purpose Specificity (white fill, 1px #728A97 border, 2px focus ring) */}
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-purpose`} className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">
                Stated Clinical Purpose (DPDP Compliance)
              </label>
              <textarea
                id={`${uid}-purpose`}
                value={clinicalPurpose}
                onChange={(e) => setClinicalPurpose(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-xl bg-card border border-[#728A97] text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                required
              />
              <span className="text-3xs text-ink-muted">
                Purpose is logged in the permanent audit trail and visible to the patient.
              </span>
            </div>

            {/* Duration / Token TTL Segmented Control */}
            <div className="flex flex-col gap-1">
              <span id={`${uid}-ttl`} className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">Access Token Validity (TTL)</span>
              <div role="group" aria-labelledby={`${uid}-ttl`} className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    aria-pressed={durationMinutes === mins}
                    className={`py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      durationMinutes === mins
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-base text-ink-muted border-ink/5 hover:bg-fog'
                    }`}
                  >
                    <Icon name="clock" size={14} className="inline-block align-[-2px]" /> {mins} Min
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div role="alert" className="text-2xs text-danger-deep bg-danger-tint px-3 py-2 rounded-xl">{error}</div>
            )}

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedRecord}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary-deep text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99]"
              >
                <Icon name="notification" size={18} />
                <span>{isSubmitting ? 'Requesting...' : 'Dispatch Consent Request'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
