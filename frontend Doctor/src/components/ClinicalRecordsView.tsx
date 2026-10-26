import React, { useEffect, useRef, useState } from 'react';
import { api, type PatientSummary, type RecordSummary } from '../services/api';
import { type SupportedLanguage, t, formatLocalizedName, stripNonLatinParentheses } from '../utils/translations';
import { Icon, type IconName } from './ui/Icon';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface ClinicalRecordsViewProps {
  patient?: PatientSummary | null;
  onRequestConsent: () => void;
  selectedLanguage?: SupportedLanguage;
  /** Bump to refetch (e.g. after the patient grants consent). */
  refreshKey?: number;
}

interface ClinicalRecord {
  id: string;
  title: string;
  facility: string;
  date: string;
  type: string;
  consentStatus: string;
  status: string;
  expiresIn: string;
  findings: string;
  isUnlocked: boolean;
  imagingData?: {
    modality: string;
    organ: string;
    findingsSummary: string;
    caliperMeasurement: string;
    operator: string;
  };
  labData?: {
    test: string;
    value: string;
    unit: string;
    range: string;
    flag: 'normal' | 'elevated' | 'low';
  }[];
}

const minutesLeftLabel = (expiresAt: string | null) => {
  if (!expiresAt) return 'Access active';
  const mins = Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'Expiring now';
  if (mins < 60) return `${mins} mins remaining`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m remaining`;
};

const toClinicalRecord = (r: RecordSummary): ClinicalRecord => {
  const isUnlocked = r.consent_status === 'approved';
  return {
    id: r.record_id,
    title: r.title,
    facility: r.facility || 'ABDM linked facility',
    date: r.date_str,
    type: r.type_label || r.record_type,
    consentStatus: r.consent_status,
    status: isUnlocked
      ? 'Active Consent Granted'
      : r.consent_status === 'expired'
      ? 'Consent Expired — Request Again'
      : 'Encrypted — Consent Required',
    expiresIn: isUnlocked
      ? minutesLeftLabel(r.consent_expires_at)
      : r.consent_status === 'expired'
      ? 'Consent window lapsed'
      : 'DPDP Act 2023 Protected',
    findings:
      (isUnlocked && r.summary_findings) ||
      (r.consent_status === 'expired'
        ? 'Consent token expired. Request a new purpose-bound consent from the patient to view this record again.'
        : 'Encrypted FHIR artifact. Requires patient OTP consent token to decrypt and inspect clinical notes.'),
    isUnlocked,
    imagingData: r.imaging || undefined,
    labData: r.lab_results || undefined,
  };
};

const getRecordTypeIcon = (type: string): IconName => {
  const t = type.toLowerCase();
  if (t.includes('imaging') || t.includes('scan') || t.includes('ultrasound') || t.includes('usg') || t.includes('radiology')) return 'imaging';
  if (t.includes('prescription') || t.includes('medication') || t.includes('rx')) return 'medication';
  if (t.includes('lab') || t.includes('biochemistry') || t.includes('diagnostic')) return 'records';
  if (t.includes('discharge') || t.includes('summary')) return 'clinicalNotes';
  return 'chart';
};

export const ClinicalRecordsView: React.FC<ClinicalRecordsViewProps> = ({
  patient,
  onRequestConsent,
  selectedLanguage = 'en',
  refreshKey = 0,
}) => {
  const [selectedScan, setSelectedScan] = useState<ClinicalRecord | null>(null);
  const scanDialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(selectedScan !== null, scanDialogRef, () => setSelectedScan(null));
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!patient?.patient_id) return;
    let cancelled = false;
    setStatus('loading');
    api
      .getPatientRecords(patient.patient_id)
      .then((rows) => {
        if (cancelled) return;
        setRecords(rows.map(toClinicalRecord));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [patient?.patient_id, refreshKey]);

  if (!patient) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-card rounded-xl border border-card-border shadow-2xs">
        <Icon name="records" size={38} tone="muted" weight="duotone" />
        <h3 className="text-base font-semibold text-ink mt-3">Select a patient from the queue</h3>
        <p className="text-xs text-ink-muted mt-1 max-w-sm">
          Choose a patient in the Patient Queue to view their ABDM health records and decrypted clinical vault.
        </p>
      </div>
    );
  }

  const unlockedCount = records.filter((r) => r.isUnlocked).length;
  const lockedCount = records.length - unlockedCount;

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header: title "Clinical Records" (24px); subtitle shows patient name and ABHA once (13px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-card-border">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold font-serif text-ink tracking-tight">
            Clinical Records
          </h1>
          <p className="text-[13px] text-ink-muted flex flex-wrap items-center gap-1.5 font-sans mt-0.5">
            <span className="font-semibold text-ink">{formatLocalizedName(patient.full_name, selectedLanguage)}</span>
            <span>•</span>
            <span className="font-mono text-primary bg-primary-tint px-1.5 py-0.5 rounded text-2xs">
              {patient.abha_address}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lockedCount > 0 && (
            <span className="text-xs text-ink-muted font-medium">
              {lockedCount} locked
            </span>
          )}

          <button
            type="button"
            onClick={onRequestConsent}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-deep active:scale-95 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Icon name="unlock" size={15} />
            <span>{t(selectedLanguage, 'requestConsentToken')}</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {records.length === 0 && (
        <div className="py-12 text-center text-xs text-ink-muted bg-card rounded-xl border border-card-border p-8">
          {status === 'loading' && 'Loading records from the ABDM vault…'}
          {status === 'error' && 'Could not load records. Check that the backend is running.'}
          {status === 'ready' && 'No ABDM records are linked for this patient yet.'}
        </div>
      )}

      {/* Compact list rows: record type (~180px with icon) | title | facility (wraps) · date | status chip | action */}
      {records.length > 0 && (
        <div className="bg-card rounded-xl border border-card-border shadow-2xs divide-y divide-card-border overflow-hidden">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="min-h-[56px] px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-fog/30 transition-colors"
            >
              {/* Record Type: 12px, uppercase with domain icon, ~180px, wraps to 2 lines without ellipsis */}
              <div className="w-[180px] shrink-0 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-fog flex items-center justify-center text-ink-muted shrink-0 border border-card-border">
                  <Icon name={getRecordTypeIcon(rec.type)} size={13} tone="muted" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted leading-tight line-clamp-2">
                  {rec.type}
                </span>
              </div>

              {/* Title + optional expired line */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className="text-sm font-semibold text-ink leading-snug break-words">
                  {stripNonLatinParentheses(rec.title)}
                </span>
                {rec.consentStatus === 'expired' && (
                  <span className="text-2xs text-ink-muted mt-0.5">
                    Consent expired, request new consent
                  </span>
                )}
              </div>

              {/* Facility (wraps instead of truncating) · Date */}
              <div className="hidden md:flex flex-col text-xs text-ink-muted shrink-0 w-44 lg:w-52 leading-tight">
                <span className="font-medium text-ink break-words leading-tight">
                  {stripNonLatinParentheses(rec.facility)}
                </span>
                <span className="text-2xs text-ink-muted font-mono mt-0.5">{rec.date}</span>
              </div>

              {/* One Status Chip: Locked / Unlocked */}
              <div className="shrink-0">
                {rec.isUnlocked ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-success-tint text-success-deep">
                    <Icon name="verified" size={13} />
                    <span>Unlocked</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-fog text-ink-muted border border-card-border">
                    <Icon name="lock" size={13} />
                    <span>Locked</span>
                  </span>
                )}
              </div>

              {/* Action Button: View Scan or Authorize (tonal navy, not red) */}
              <div className="shrink-0 w-24 flex justify-end">
                {rec.isUnlocked ? (
                  <button
                    type="button"
                    onClick={() => setSelectedScan(rec)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-tint hover:bg-primary/20 text-primary text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                  >
                    <Icon name="view" size={14} />
                    <span>{t(selectedLanguage, 'viewScan')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRequestConsent}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-navy-tint hover:bg-navy/20 text-navy-deep border border-navy/20 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                  >
                    <Icon name="key" size={14} />
                    <span>{t(selectedLanguage, 'authorize')}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Scan / Diagnostic Viewer Modal */}
      {selectedScan && (
        <div className="fixed inset-0 z-50 bg-night/45 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={scanDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-viewer-title"
            className="w-full max-w-2xl bg-card rounded-3xl shadow-lg border border-ink/10 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-base border-b border-ink/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Icon name="imaging" size={20} />
                </div>
                <div>
                  <h3 id="scan-viewer-title" className="text-base font-bold text-ink tracking-tight">
                    {stripNonLatinParentheses(selectedScan.title)}
                  </h3>
                  <p className="text-2xs text-ink-muted">
                    {stripNonLatinParentheses(selectedScan.facility)} • {selectedScan.date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedScan(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-card hover:bg-ink/5 text-ink flex items-center justify-center shadow-sm transition-all"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* If Ultrasound */}
              {selectedScan.imagingData && (
                <div className="flex flex-col gap-4">
                  {/* High contrast simulated USG viewport */}
                  <div className="relative rounded-2xl bg-night overflow-hidden aspect-[16/9] flex items-center justify-center border border-white/10 shadow-inner">
                    {/* Simulated ultrasound visual */}
                    <div className="absolute inset-0 bg-radial from-night via-night to-night opacity-80" />
                    
                    {/* Caliper overlay */}
                    <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                      <div className="w-24 h-24 rounded-full border border-dashed border-success/70 flex items-center justify-center relative">
                        <div className="w-2 h-2 rounded-full bg-success shadow-lg shadow-success" />
                        <span className="absolute -top-6 text-3xs font-mono text-success bg-night/70 px-1.5 py-0.5 rounded">
                          + 4.2mm (Caliper 1)
                        </span>
                      </div>
                      <span className="text-xs font-mono text-white/60">
                        Right Lower Pole Calyx Calculus
                      </span>
                    </div>

                    {/* Metadata HUD */}
                    <div className="absolute top-3 left-3 text-3xs font-mono text-white/70 bg-night/60 px-2 py-1 rounded backdrop-blur-sm">
                      <div>GE LOGIQ E9 • B-MODE</div>
                      <div>GAIN: 68dB • TIS: 0.4 • MI: 0.9</div>
                      <div>DEPTH: 14.0cm • FPS: 28Hz</div>
                    </div>

                    <div className="absolute bottom-3 right-3 text-3xs font-mono text-success bg-night/60 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                      <Icon name="verified" size={12} />
                      <span>FHIR DICOM Verified</span>
                    </div>
                  </div>

                  {/* Metadata Specs */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-base border border-ink/5">
                      <span className="text-3xs text-ink-muted uppercase font-semibold block">Modality</span>
                      <span className="font-semibold text-ink">{selectedScan.imagingData.modality}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-base border border-ink/5">
                      <span className="text-3xs text-ink-muted uppercase font-semibold block">Measurement</span>
                      <span className="font-semibold text-ink">{selectedScan.imagingData.caliperMeasurement}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* If Biochemistry Panel */}
              {selectedScan.labData && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-ink/10 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-base text-ink-muted text-3xs font-bold uppercase tracking-wider border-b border-ink/5">
                        <tr>
                          <th className="px-4 py-2.5">Biomarker</th>
                          <th className="px-4 py-2.5">Result</th>
                          <th className="px-4 py-2.5">Reference Interval</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/5">
                        {selectedScan.labData.map((lab, i) => (
                          <tr key={i} className="hover:bg-ink/2">
                            <td className="px-4 py-2.5 font-medium text-ink">{lab.test}</td>
                            <td className="px-4 py-2.5 font-bold text-ink">
                              {lab.value} <span className="text-2xs font-normal text-ink-muted">{lab.unit}</span>
                            </td>
                            <td className="px-4 py-2.5 text-ink-muted">{lab.range} {lab.unit}</td>
                            <td className="px-4 py-2.5">
                              {lab.flag === 'elevated' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-warning-tint text-warning-deep">
                                  Elevated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-success-tint text-success-deep">
                                  Normal
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full Clinical Impression */}
              <div className="p-4 rounded-xl bg-base border border-ink/5 flex flex-col gap-1.5">
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                  Diagnostic Impression & Conclusion
                </span>
                <p className="text-xs text-ink leading-relaxed">
                  {stripNonLatinParentheses(selectedScan.findings)}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-base border-t border-ink/5 flex items-center justify-between text-xs">
              <span className="text-2xs text-ink-muted">
                Decrypted under Ayushman Bharat Digital Mission (ABDM) Token #{selectedScan.id}
              </span>
              <button
                onClick={() => setSelectedScan(null)}
                className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-deep text-white font-semibold transition-all active:scale-95"
              >
                {t(selectedLanguage, 'done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
