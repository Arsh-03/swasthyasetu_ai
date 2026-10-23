import React, { useEffect, useState } from 'react';
import { api, type PatientSummary, type RecordSummary } from '../services/api';
import { type SupportedLanguage, t } from '../utils/translations';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-black/5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-[#1C1C1E] tracking-tight">
              {t(selectedLanguage, 'vaultTitle')}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#007AFF]/10 text-[#007AFF]">
              <span className="material-symbols-outlined text-[13px]">shield</span>
              <span>FHIR R4 Encrypted</span>
            </span>
          </div>
          <p className="text-xs text-[#8E8E93] flex flex-wrap items-center gap-1.5">
            <span>{t(selectedLanguage, 'encryptedArtifacts')}</span>
            <span className="font-semibold text-[#1C1C1E]">{patient.full_name}</span>
            <span className="font-mono text-[#007AFF] bg-[#007AFF]/10 px-1.5 py-0.5 rounded text-[11px]">
              {patient.abha_address}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-2 text-xs text-[#8E8E93] bg-[#F2F2F7] px-3 py-1.5 rounded-xl">
            <span className="inline-block w-2 h-2 rounded-full bg-[#34C759]" />
            <span>{unlockedCount} {t(selectedLanguage, 'decrypted')}</span>
            <span>•</span>
            <span className="inline-block w-2 h-2 rounded-full bg-[#FF9500]" />
            <span>{lockedCount} Locked</span>
          </div>

          <button
            onClick={onRequestConsent}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] active:scale-95 text-white text-xs font-semibold transition-all shadow-apple-sm"
          >
            <span className="material-symbols-outlined text-[16px]">lock_open</span>
            <span>{t(selectedLanguage, 'requestConsentToken')}</span>
          </button>
        </div>
      </div>

      {/* 3-Column Card Grid with Generous Padding & Zero Overflow */}
      {records.length === 0 && (
        <div className="py-12 text-center text-xs text-[#8E8E93]">
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
              className={`rounded-2xl p-5 sm:p-6 shadow-apple-sm border flex flex-col justify-between transition-all hover:shadow-apple-md ${
                rec.isUnlocked
                  ? 'bg-white border-[#34C759]/30 ring-1 ring-[#34C759]/15'
                  : 'bg-[#F9F9FB] border-black/10'
              }`}
            >
              {/* Card Top & Body Content */}
              <div className="flex flex-col gap-3">
                {/* Eyebrow & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    {rec.type}
                  </span>
                  {rec.isUnlocked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#34C759]/10 text-[#248A3D] shrink-0">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>{t(selectedLanguage, 'decrypted')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/10 text-[#C97700] shrink-0">
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                      <span>{t(selectedLanguage, 'consentGated')}</span>
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-[16px] font-bold text-[#1C1C1E] tracking-tight leading-snug">
                  {rec.title}
                </h3>

                {/* Facility & Date */}
                <div className="text-xs text-[#636366] flex items-center gap-1.5 flex-wrap">
                  <span className="material-symbols-outlined text-[14px] text-[#8E8E93]">apartment</span>
                  <span className="font-medium text-[#1C1C1E]">{rec.facility}</span>
                  <span className="text-[#8E8E93]">•</span>
                  <span className="text-[#8E8E93]">{rec.date}</span>
                </div>

                {/* Clinical Findings Well */}
                <div
                  className={`mt-1 p-3.5 rounded-xl text-xs leading-relaxed border ${
                    rec.isUnlocked
                      ? 'bg-[#F2F2F7] text-[#1C1C1E] border-black/5'
                      : 'bg-[#F2F2F7]/70 text-[#8E8E93] border-black/5 italic'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
                    <span className="material-symbols-outlined text-[13px]">
                      {rec.isUnlocked ? 'clinical_notes' : 'key'}
                    </span>
                    <span>{rec.isUnlocked ? t(selectedLanguage, 'clinicalFindings') : t(selectedLanguage, 'dpdpNote')}</span>
                  </div>
                  {rec.findings}
                </div>
              </div>

              {/* Card Footer with Generous Spacing and Wrap Protection */}
              <div className="pt-4 mt-5 border-t border-black/5 flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    rec.isUnlocked
                      ? 'bg-[#34C759]/15 text-[#248A3D]'
                      : 'bg-[#FF9500]/15 text-[#C97700]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {rec.isUnlocked ? 'schedule' : 'security'}
                  </span>
                  <span>{rec.expiresIn}</span>
                </span>

                {rec.isUnlocked ? (
                  <button
                    onClick={() => setSelectedScan(rec)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] text-xs font-semibold transition-all active:scale-95 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[15px]">visibility</span>
                    <span>{t(selectedLanguage, 'viewScan')}</span>
                  </button>
                ) : (
                  <button
                    onClick={onRequestConsent}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-xs font-semibold transition-all active:scale-95 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[15px]">key</span>
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
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-apple-lg border border-black/10 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#F2F2F7] border-b border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#007AFF]/15 text-[#007AFF] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">radiology</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight">
                    {selectedScan.title}
                  </h3>
                  <p className="text-[11px] text-[#8E8E93]">
                    {selectedScan.facility} • {selectedScan.date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedScan(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-black/5 text-[#1C1C1E] flex items-center justify-center shadow-apple-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* If Ultrasound */}
              {selectedScan.imagingData && (
                <div className="flex flex-col gap-4">
                  {/* High contrast simulated USG viewport */}
                  <div className="relative rounded-2xl bg-black overflow-hidden aspect-[16/9] flex items-center justify-center border border-white/10 shadow-inner">
                    {/* Simulated ultrasound visual */}
                    <div className="absolute inset-0 bg-radial from-neutral-800 via-neutral-950 to-black opacity-80" />
                    
                    {/* Caliper overlay */}
                    <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                      <div className="w-24 h-24 rounded-full border border-dashed border-[#34C759]/70 flex items-center justify-center relative">
                        <div className="w-2 h-2 rounded-full bg-[#34C759] shadow-lg shadow-[#34C759]" />
                        <span className="absolute -top-6 text-[10px] font-mono text-[#34C759] bg-black/70 px-1.5 py-0.5 rounded">
                          + 4.2mm (Caliper 1)
                        </span>
                      </div>
                      <span className="text-xs font-mono text-white/60">
                        Right Lower Pole Calyx Calculus
                      </span>
                    </div>

                    {/* Metadata HUD */}
                    <div className="absolute top-3 left-3 text-[10px] font-mono text-white/70 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                      <div>GE LOGIQ E9 • B-MODE</div>
                      <div>GAIN: 68dB • TIS: 0.4 • MI: 0.9</div>
                      <div>DEPTH: 14.0cm • FPS: 28Hz</div>
                    </div>

                    <div className="absolute bottom-3 right-3 text-[10px] font-mono text-[#34C759] bg-black/60 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      <span>FHIR DICOM Verified</span>
                    </div>
                  </div>

                  {/* Metadata Specs */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F2F2F7] border border-black/5">
                      <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block">Modality</span>
                      <span className="font-semibold text-[#1C1C1E]">{selectedScan.imagingData.modality}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F2F2F7] border border-black/5">
                      <span className="text-[10px] text-[#8E8E93] uppercase font-semibold block">Measurement</span>
                      <span className="font-semibold text-[#1C1C1E]">{selectedScan.imagingData.caliperMeasurement}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* If Biochemistry Panel */}
              {selectedScan.labData && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-black/10 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F2F2F7] text-[#8E8E93] text-[10px] font-bold uppercase tracking-wider border-b border-black/5">
                        <tr>
                          <th className="px-4 py-2.5">Biomarker</th>
                          <th className="px-4 py-2.5">Result</th>
                          <th className="px-4 py-2.5">Reference Interval</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {selectedScan.labData.map((lab, i) => (
                          <tr key={i} className="hover:bg-black/[0.02]">
                            <td className="px-4 py-2.5 font-medium text-[#1C1C1E]">{lab.test}</td>
                            <td className="px-4 py-2.5 font-bold text-[#1C1C1E]">
                              {lab.value} <span className="text-[11px] font-normal text-[#8E8E93]">{lab.unit}</span>
                            </td>
                            <td className="px-4 py-2.5 text-[#636366]">{lab.range} {lab.unit}</td>
                            <td className="px-4 py-2.5">
                              {lab.flag === 'elevated' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF9500]/15 text-[#C97700]">
                                  Elevated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#34C759]/15 text-[#248A3D]">
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
              <div className="p-4 rounded-xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  Diagnostic Impression & Conclusion
                </span>
                <p className="text-xs text-[#1C1C1E] leading-relaxed">
                  {selectedScan.findings}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#F2F2F7] border-t border-black/5 flex items-center justify-between text-xs">
              <span className="text-[11px] text-[#8E8E93]">
                Decrypted under Ayushman Bharat Digital Mission (ABDM) Token #{selectedScan.id}
              </span>
              <button
                onClick={() => setSelectedScan(null)}
                className="px-4 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold transition-all active:scale-95"
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
