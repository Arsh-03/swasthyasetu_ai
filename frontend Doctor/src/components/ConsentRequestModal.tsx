import React, { useEffect, useState } from 'react';
import type { PatientSummary, RecordSummary } from '../services/api';
import { api } from '../services/api';

interface ConsentRequestModalProps {
  patient: PatientSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ConsentRequestModal: React.FC<ConsentRequestModalProps> = ({
  patient,
  isOpen,
  onClose,
  onSuccess,
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-apple-lg border border-black/10 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-black/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white shadow-apple-sm">
              <span className="material-symbols-outlined text-[20px]">key</span>
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-[#1C1C1E] tracking-tight">DPDP Consent Request</h3>
              <span className="text-[11px] text-[#8E8E93]">Digital Personal Data Protection Act 2023 Gate</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#E5E5EA]/70 hover:bg-[#E5E5EA] text-[#1C1C1E] flex items-center justify-center transition-colors ring-1 ring-black/5 active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {sentSuccess ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2.5 text-center">
            <div className="w-14 h-14 rounded-full bg-[#34C759]/15 text-[#34C759] flex items-center justify-center animate-bounce">
              <span className="material-symbols-outlined text-3xl">send</span>
            </div>
            <h4 className="text-lg font-bold text-[#1C1C1E] tracking-tight">Push Notification Dispatched</h4>
            <p className="text-xs text-[#636366] max-w-xs leading-relaxed">
              A high-priority OTP verification modal has been sent via WebSockets to {patient.full_name}'s mobile device.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Target Patient Info */}
            <div className="p-3 rounded-2xl bg-[#F2F2F7] flex items-center justify-between border border-black/5">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-[#8E8E93] uppercase">Subject Data Principal</span>
                <span className="text-sm font-semibold text-[#1C1C1E]">{patient.full_name}</span>
              </div>
              <span className="text-xs font-mono font-semibold text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-0.5 rounded-full">
                {patient.abha_address}
              </span>
            </div>

            {/* Target Health Record */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Requested Record Artifact</label>
              <select
                value={selectedRecord}
                onChange={(e) => setSelectedRecord(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA]/70 border border-black/5 text-xs font-semibold text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF]"
              >
                {recordsStatus === 'loading' && <option value="">Loading records…</option>}
                {recordsStatus === 'error' && <option value="">Could not load records</option>}
                {recordsStatus === 'ready' && records.length === 0 && (
                  <option value="">No ABDM records linked for this patient</option>
                )}
                {records.map((r) => (
                  <option key={r.record_id} value={r.record_id}>
                    {r.title} ({r.date_str}){r.consent_status === 'approved' ? ' — access active' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Purpose Specificity */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                Stated Clinical Purpose (DPDP Compliance)
              </label>
              <textarea
                value={clinicalPurpose}
                onChange={(e) => setClinicalPurpose(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA]/70 border border-black/5 text-xs text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF]"
                required
              />
              <span className="text-[10px] text-[#8E8E93]">
                Purpose is logged in the permanent audit trail and visible to the patient.
              </span>
            </div>

            {/* Duration / Token TTL Segmented Control */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Access Token Validity (TTL)</label>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      durationMinutes === mins
                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-apple-sm'
                        : 'bg-[#F2F2F7] text-[#636366] border-black/5 hover:bg-[#E5E5EA]'
                    }`}
                  >
                    ⏱️ {mins} Min
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-[11px] text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-2 rounded-xl">{error}</div>
            )}

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedRecord}
                className="w-full h-11 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold text-xs shadow-apple-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99]"
              >
                <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                <span>{isSubmitting ? 'Requesting...' : 'Dispatch Consent Request'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
