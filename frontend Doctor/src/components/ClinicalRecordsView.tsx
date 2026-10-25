import React, { useEffect, useRef, useState } from 'react';
import { api, type PatientSummary, type RecordSummary } from '../services/api';
import { type SupportedLanguage, t } from '../utils/translations';
import { Icon } from './ui/Icon';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface ClinicalRecordsViewProps {
  patient: PatientSummary;
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
  }, [patient.patient_id, refreshKey]);

  const unlockedCount = records.filter((r) => r.isUnlocked).length;
  const lockedCount = records.length - unlockedCount;

  return (
    <div className="w-full max-w-7xl mx-auto px-5 lg:px-8 py-7 flex flex-col gap-6">
      {/* Header with Title and Consent CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-ink/5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-ink tracking-tight">
              {t(selectedLanguage, 'vaultTitle')}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-primary-tint text-primary">
              <Icon name="shield" size={13} />
              <span>FHIR R4 Encrypted</span>
            </span>
          </div>
          <p className="text-xs text-ink-muted flex flex-wrap items-center gap-1.5">
            <span>{t(selectedLanguage, 'encryptedArtifacts')}</span>
            <span className="font-semibold text-ink">{patient.full_name}</span>
            <span className="font-mono text-primary bg-primary-tint px-1.5 py-0.5 rounded text-2xs">
              {patient.abha_address}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-2 text-xs text-ink-muted bg-base px-3 py-1.5 rounded-xl">
            <span className="inline-block w-2 h-2 rounded-full bg-success" />
            <span>{unlockedCount} {t(selectedLanguage, 'decrypted')}</span>
            <span>•</span>
            <span className="inline-block w-2 h-2 rounded-full bg-warning" />
            <span>{lockedCount} Locked</span>
          </div>

          <button
            onClick={onRequestConsent}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-deep active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
          >
            <Icon name="unlock" size={16} />
            <span>{t(selectedLanguage, 'requestConsentToken')}</span>
          </button>
        </div>
      </div>

      {/* 3-Column Card Grid with Generous Padding & Zero Overflow */}
      {records.length === 0 && (
        <div className="py-12 text-center text-xs text-ink-muted">
          {status === 'loading' && 'Loading records from the ABDM vault…'}
          {status === 'error' && 'Could not load records. Check that the backend is running.'}
          {status === 'ready' && 'No ABDM records are linked for this patient yet.'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {records.map((rec) => {
          return (
            <div
              key={rec.id}
              className={`rounded-2xl p-5 sm:p-6 shadow-sm border flex flex-col justify-between transition-all hover:shadow-md ${
                rec.isUnlocked
                  ? 'bg-card border-success/30 ring-1 ring-success/15'
                  : 'bg-sand border-ink/10'
              }`}
            >
              {/* Card Top & Body Content */}
              <div className="flex flex-col gap-3">
                {/* Eyebrow & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">
                    {rec.type}
                  </span>
                  {rec.isUnlocked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-success-tint text-success-deep shrink-0">
                      <Icon name="verified" size={14} />
                      <span>{t(selectedLanguage, 'decrypted')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-warning-tint text-warning-deep shrink-0">
                      <Icon name="lock" size={14} />
                      <span>{t(selectedLanguage, 'consentGated')}</span>
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-ink tracking-tight leading-snug">
                  {rec.title}
                </h3>

                {/* Facility & Date */}
                <div className="text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
                  <Icon name="building" size={14} tone="muted" weight="duotone" />
                  <span className="font-medium text-ink">{rec.facility}</span>
                  <span className="text-ink-muted">•</span>
                  <span className="text-ink-muted">{rec.date}</span>
                </div>

                {/* Clinical Findings Well */}
                <div
                  className={`mt-1 p-3.5 rounded-xl text-xs leading-relaxed border ${
                    rec.isUnlocked
                      ? 'bg-base text-ink border-ink/5'
                      : 'bg-base/70 text-ink-muted border-ink/5 italic'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-3xs font-bold uppercase tracking-wider text-ink-muted">
                    <Icon name={rec.isUnlocked ? 'clinicalNotes' : 'key'} size={13} />
                    <span>{rec.isUnlocked ? t(selectedLanguage, 'clinicalFindings') : t(selectedLanguage, 'dpdpNote')}</span>
                  </div>
                  {rec.findings}
                </div>
              </div>

              {/* Card Footer with Generous Spacing and Wrap Protection */}
              <div className="pt-4 mt-5 border-t border-ink/5 flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 text-2xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    rec.isUnlocked
                      ? 'bg-success-tint text-success-deep'
                      : 'bg-warning-tint text-warning-deep'
                  }`}
                >
                  <Icon name={rec.isUnlocked ? 'clock' : 'shield'} size={13} />
                  <span>{rec.expiresIn}</span>
                </span>

                {rec.isUnlocked ? (
                  <button
                    onClick={() => setSelectedScan(rec)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-tint hover:bg-primary/10 text-primary text-xs font-semibold transition-all active:scale-95 shrink-0"
                  >
                    <Icon name="view" size={15} />
                    <span>{t(selectedLanguage, 'viewScan')}</span>
                  </button>
                ) : (
                  <button
                    onClick={onRequestConsent}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger-tint hover:bg-danger/10 text-danger-deep text-xs font-semibold transition-all active:scale-95 shrink-0"
                  >
                    <Icon name="key" size={15} />
                    <span>{t(selectedLanguage, 'authorize')}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
                    {selectedScan.title}
                  </h3>
                  <p className="text-2xs text-ink-muted">
                    {selectedScan.facility} • {selectedScan.date}
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
                  {selectedScan.findings}
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
