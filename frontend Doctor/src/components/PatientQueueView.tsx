import React from 'react';
import type { PatientSummary } from '../services/api';
import {
  t,
  type SupportedLanguage,
  formatLocalizedName,
  formatLocalizedComplaint,
  stripNonLatinParentheses,
} from '../utils/translations';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';

interface PatientQueueViewProps {
  patients: PatientSummary[];
  selectedPatient: PatientSummary;
  onSelectPatient: (patient: PatientSummary) => void;
  onStartConsultation: (patient: PatientSummary) => void;
  searchQuery: string;
  onOpenPatientChart: (patient: PatientSummary) => void;
  selectedLanguage: SupportedLanguage;
}

export const PatientQueueView: React.FC<PatientQueueViewProps> = ({
  patients,
  selectedPatient,
  onSelectPatient,
  onStartConsultation,
  searchQuery,
  onOpenPatientChart,
  selectedLanguage,
}) => {
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    const locName = formatLocalizedName(p.full_name, selectedLanguage).toLowerCase();
    const origName = p.full_name.toLowerCase();
    const abha = p.abha_address.toLowerCase();
    const complaint = (p.complaint || '').toLowerCase();
    return locName.includes(q) || origName.includes(q) || abha.includes(q) || complaint.includes(q);
  });

  const highPriorityCount = filteredPatients.filter((p) => p.urgency === 'high').length;

  const handleAudioListen = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const localizedSelectedName = formatLocalizedName(selectedPatient.full_name, selectedLanguage);
  const localizedSelectedComplaint = formatLocalizedComplaint(selectedPatient.complaint, selectedLanguage);

  return (
    <div className="w-full h-full flex flex-col gap-3 min-h-0 overflow-hidden">
      {/* Merged Compact Stat Strip (~56px) */}
      <div className="h-14 bg-card rounded-xl px-4 sm:px-5 border border-card-border shadow-2xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Stat 1: Queue Active */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-tint text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Icon name="hourglass" size={17} tone="primary" weight="duotone" />
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                {t(selectedLanguage, 'queueActive')}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg sm:text-xl font-bold text-ink leading-none">
                  {filteredPatients.length}
                </span>
                <span className="text-3xs text-primary font-medium leading-none">
                  {highPriorityCount} {t(selectedLanguage, 'activeWaiting')}
                </span>
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-card-border" />

          {/* Stat 2: Scheduled Today */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-warning-tint text-warning flex items-center justify-center shrink-0 border border-warning/20">
              <Icon name="calendar" size={17} tone="warning" weight="duotone" />
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                {t(selectedLanguage, 'scheduledToday')}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg sm:text-xl font-bold text-ink leading-none">8</span>
                <span className="text-3xs text-warning-deep font-medium leading-none">
                  {t(selectedLanguage, 'nextIn')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-2xs text-ink-muted font-medium">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span>ABDM Triage Sync Live</span>
        </div>
      </div>

      {/* Two Panes Split View Layout Filling Remaining Height */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch overflow-hidden">
        {/* Left Pane: Queue List (approx 40% width, 5 of 12 cols) */}
        <section className="lg:col-span-5 h-full flex flex-col min-h-0 overflow-hidden bg-card rounded-xl border border-card-border shadow-2xs">
          {/* Queue List Header */}
          <div className="p-3 px-3.5 border-b border-card-border shrink-0 flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink tracking-tight">
                {t(selectedLanguage, 'triageQueue')}
              </h2>
              <span className="text-3xs font-semibold text-primary bg-primary-tint px-2 py-0.5 rounded-full">
                {filteredPatients.length} {t(selectedLanguage, 'waitingTag')}
              </span>
            </div>
            <span className="text-3xs text-ink-muted">
              {t(selectedLanguage, 'clickToOpen')}
            </span>
          </div>

          {/* Independently Scrolling Flat Queue Rows with Hairline Dividers */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-card-border">
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient.patient_id === patient.patient_id;
              const locName = formatLocalizedName(patient.full_name, selectedLanguage);
              const locComplaint = formatLocalizedComplaint(patient.complaint, selectedLanguage);

              return (
                <article
                  key={patient.patient_id}
                  onClick={() => {
                    if (isSelected) {
                      onOpenPatientChart(patient);
                    } else {
                      onSelectPatient(patient);
                    }
                  }}
                  onDoubleClick={() => {
                    onSelectPatient(patient);
                    onOpenPatientChart(patient);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-current={isSelected ? 'true' : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPatient(patient);
                      onOpenPatientChart(patient);
                    }
                  }}
                  className={`p-2.5 px-3 flex items-center justify-between cursor-pointer transition-colors group border-l-[3px] ${
                    isSelected
                      ? 'bg-ice border-l-primary font-medium'
                      : 'bg-transparent border-l-transparent hover:bg-ice/40'
                  }`}
                >
                  {/* Left: Avatar + Details */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={patient.avatar_url}
                      name={locName}
                      size={36}
                      domain={
                        patient.urgency === 'high'
                          ? 'emergency'
                          : patient.urgency === 'follow_up'
                          ? 'followup'
                          : 'appointments'
                      }
                    />
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="text-xs font-semibold text-ink truncate group-hover:text-primary transition-colors">
                        {locName}
                      </span>
                      <span className="text-3xs text-ink-muted truncate mt-0.5">
                        {locComplaint || 'General consultation'}
                      </span>
                      <span className="text-4xs font-mono text-ink-muted mt-0.5">
                        {patient.abha_address}
                      </span>
                    </div>
                  </div>

                  {/* Right: Priority Chip & Quick Open Action */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    {patient.urgency === 'high' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-danger-tint text-danger-deep text-4xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
                        {t(selectedLanguage, 'urgent')}
                      </span>
                    ) : patient.urgency === 'follow_up' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning-tint text-warning-deep text-4xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                        {t(selectedLanguage, 'followUp')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success-tint text-success-deep text-4xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                        {t(selectedLanguage, 'routine')}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPatient(patient);
                        onOpenPatientChart(patient);
                      }}
                      title="Open full chart"
                      className="p-1 rounded text-ink-muted hover:text-primary hover:bg-primary-tint/60 transition-colors"
                      aria-label="Open full chart"
                    >
                      <Icon name="chevronRight" size={13} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Right Pane: Patient Preview (approx 60% width, 7 of 12 cols) with Pinned Footer */}
        <section className="lg:col-span-7 h-full flex flex-col min-h-0 overflow-hidden bg-card rounded-xl border border-card-border shadow-2xs">
          {/* Scrollable Preview Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3.5">
            {/* Header: Avatar, Name, Demographics, Listen Audio */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-card-border">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={selectedPatient.avatar_url}
                  name={localizedSelectedName}
                  size={56}
                  domain={
                    selectedPatient.urgency === 'high'
                      ? 'emergency'
                      : selectedPatient.urgency === 'follow_up'
                      ? 'followup'
                      : 'appointments'
                  }
                />
                <div className="flex flex-col min-w-0">
                  <h3 className="text-xl font-bold font-serif text-ink tracking-tight leading-tight truncate">
                    {localizedSelectedName}
                  </h3>
                  <span className="text-xs text-ink-muted mt-0.5 font-sans">
                    {[
                      selectedPatient.demographics.age ? `${selectedPatient.demographics.age} yrs` : null,
                      selectedPatient.demographics.gender,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Patient'}
                    {selectedPatient.demographics.district ? ` • ${selectedPatient.demographics.district}` : ''}
                  </span>
                  <span className="text-3xs font-mono font-medium text-ink-muted mt-0.5 tracking-wide">
                    ABHA: {selectedPatient.abha_address}
                  </span>
                </div>
              </div>

              {/* Contextual Audio Listen Pill */}
              <button
                type="button"
                onClick={() =>
                  handleAudioListen(
                    `Patient is ${localizedSelectedName}, age ${
                      selectedPatient.demographics.age ?? 'not recorded'
                    }. Chief complaint: ${
                      localizedSelectedComplaint || 'not recorded'
                    }. Known allergy: ${
                      selectedPatient.allergies?.join(', ') || 'None reported'
                    }. Latest vitals: ${selectedPatient.vitals || 'not recorded'}.`
                  )
                }
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fog/70 text-ink hover:bg-fog text-xs font-semibold transition-all shrink-0 active:scale-95 cursor-pointer border border-card-border"
              >
                <Icon name="listen" size={15} tone="primary" weight="duotone" />
                <span>{t(selectedLanguage, 'listenSummary')}</span>
              </button>
            </div>

            {/* Status & Priority Chips (Neutral for Routine, Amber for Follow-up, Red for Urgent) */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedPatient.urgency === 'high' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-danger-tint text-danger-deep text-xs font-semibold border border-danger/20">
                  <Icon name="emergency" size={13} tone="danger" />
                  <span>{localizedSelectedComplaint || t(selectedLanguage, 'emergencyComplaint')}</span>
                </span>
              ) : selectedPatient.urgency === 'follow_up' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-tint text-warning-deep text-xs font-semibold border border-warning/20">
                  <Icon name="clock" size={13} tone="warning" />
                  <span>{localizedSelectedComplaint || t(selectedLanguage, 'followUp')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-base text-ink text-xs font-semibold border border-card-border">
                  <Icon name="clinicalNotes" size={13} tone="muted" />
                  <span>{localizedSelectedComplaint || 'Routine Consultation'}</span>
                </span>
              )}

              {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-tint text-warning-deep text-xs font-semibold">
                  <Icon name="warning" size={13} />
                  <span>{stripNonLatinParentheses(selectedPatient.allergies.join(', '))}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-tint text-success-deep text-xs font-semibold">
                <Icon name="verified" size={13} />
                <span>{t(selectedLanguage, 'abdmVerified')}</span>
              </span>
            </div>

            {/* Glanceable Vitals & Clinical Context (Tiles: white with 1px border, stacked vitals, no truncate) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col justify-between">
                <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                  {t(selectedLanguage, 'latestVitals')}
                </span>
                <div className="text-xs font-semibold text-ink mt-1 flex flex-col gap-0.5">
                  {selectedPatient.vitals ? (
                    selectedPatient.vitals
                      .split(/[·•]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((part, idx) => (
                        <span key={idx} className="leading-tight">{part}</span>
                      ))
                  ) : (
                    <span className="text-ink-muted italic">Not recorded</span>
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col justify-between">
                <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                  {t(selectedLanguage, 'previousVisit')}
                </span>
                <span className="text-xs font-semibold text-ink mt-1 leading-tight">
                  14 Sep (Hassan)
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col justify-between">
                <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                  {t(selectedLanguage, 'language')}
                </span>
                <span className="text-xs font-semibold text-ink mt-1 leading-tight">
                  {selectedLanguage === 'en'
                    ? selectedPatient.preferred_language === 'kn'
                      ? 'Kannada'
                      : selectedPatient.preferred_language === 'hi'
                      ? 'Hindi'
                      : 'English'
                    : selectedPatient.preferred_language === 'kn'
                    ? 'ಕನ್ನಡ'
                    : selectedPatient.preferred_language === 'hi'
                    ? 'हिन्दी'
                    : 'English'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col justify-between">
                <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                  Contact
                </span>
                <span className="text-xs font-semibold text-ink mt-1 leading-tight font-mono">
                  {selectedPatient.demographics.phone_masked || selectedPatient.phone_number || 'Available'}
                </span>
              </div>
            </div>

            {/* Active Medications Preview */}
            <div className="p-3 rounded-lg bg-base/60 border border-card-border flex flex-col gap-1.5">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                {t(selectedLanguage, 'activeRxTitle')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(selectedPatient.active_rx || []).length > 0 ? (
                  selectedPatient.active_rx?.map((rx, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-card text-xs font-medium text-ink border border-card-border shadow-2xs flex items-center gap-1"
                    >
                      <Icon
                        name="medication"
                        size={12}
                        tone="teal"
                        weight="duotone"
                      />
                      <span>{rx}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-ink-muted italic">No active prescriptions</span>
                )}
              </div>
            </div>

            {/* Clinical Impression & Encounter Summary Well */}
            <div className="p-3 rounded-lg bg-base/60 border border-card-border flex flex-col gap-1">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">
                Triage Clinical Notes
              </span>
              <p className="text-xs text-ink leading-relaxed">
                Patient presented with {localizedSelectedComplaint || 'routine follow-up symptoms'}. Evaluated under ABDM tele-triage protocol. Vitals stable; verify adherence to current active prescription regimen before advancing therapy.
              </p>
            </div>
          </div>

          {/* Pinned Action Buttons at Bottom of Pane */}
          <div className="p-3 px-4 border-t border-card-border bg-card shrink-0 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenPatientChart(selectedPatient)}
              className="w-full sm:flex-1 h-9 rounded-lg bg-primary text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-primary-deep active:scale-[0.99] transition-all shadow-xs cursor-pointer"
            >
              <Icon name="chart" size={15} />
              <span>{t(selectedLanguage, 'openFullChartBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => onStartConsultation(selectedPatient)}
              className="w-full sm:w-auto px-4 h-9 rounded-lg bg-success-tint hover:bg-success/20 text-success-deep text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] border border-success/20 cursor-pointer"
            >
              <Icon name="video" size={15} />
              <span>{t(selectedLanguage, 'callBtn')}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
