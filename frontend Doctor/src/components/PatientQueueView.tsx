import React from 'react';
import type { PatientSummary } from '../services/api';
import { t, type SupportedLanguage } from '../utils/translations';

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
  const filteredPatients = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.abha_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.complaint && p.complaint.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAudioListen = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-5 lg:px-8 py-5 flex flex-col gap-5">
      {/* 3 Top Apple Health Style Glanceable Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full">
        <div className="bg-white rounded-2xl p-4 shadow-apple-sm border border-black/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              {t(selectedLanguage, 'queueActive')}
            </span>
            <span className="text-3xl font-bold text-[#1C1C1E] tracking-tight mt-0.5">
              {filteredPatients.length}
            </span>
            <span className="text-[11px] text-[#007AFF] font-medium mt-0.5">
              3 {t(selectedLanguage, 'activeWaiting')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center ring-1 ring-[#007AFF]/20">
            <span className="material-symbols-outlined text-[#007AFF] text-2xl">hourglass_top</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-apple-sm border border-black/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              {t(selectedLanguage, 'scheduledToday')}
            </span>
            <span className="text-3xl font-bold text-[#1C1C1E] tracking-tight mt-0.5">8</span>
            <span className="text-[11px] text-[#FF9500] font-medium mt-0.5">
              {t(selectedLanguage, 'nextIn')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FF9500]/10 flex items-center justify-center ring-1 ring-[#FF9500]/20">
            <span className="material-symbols-outlined text-[#FF9500] text-2xl">calendar_today</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-apple-sm border border-black/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              {t(selectedLanguage, 'consentsGranted')}
            </span>
            <span className="text-3xl font-bold text-[#1C1C1E] tracking-tight mt-0.5">2</span>
            <span className="text-[11px] text-[#34C759] font-medium mt-0.5">
              {t(selectedLanguage, 'dpdpActiveTokens')}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#34C759]/10 flex items-center justify-center ring-1 ring-[#34C759]/20">
            <span className="material-symbols-outlined text-[#34C759] text-2xl">verified_user</span>
          </div>
        </div>
      </section>

      {/* Two Column Split View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
        {/* Left Column: Patient Queue (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="text-lg font-semibold text-[#1C1C1E] tracking-tight whitespace-nowrap">
                {t(selectedLanguage, 'triageQueue')}
              </h2>
              <span className="text-[11px] font-semibold text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                {filteredPatients.length} {t(selectedLanguage, 'waitingTag')}
              </span>
            </div>
            <span
              className="text-xs text-[#8E8E93] whitespace-nowrap truncate min-w-0"
              title={t(selectedLanguage, 'clickToOpen')}
            >
              {t(selectedLanguage, 'clickToOpen')}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient.patient_id === patient.patient_id;
              return (
                <article
                  key={patient.patient_id}
                  onClick={() => {
                    onSelectPatient(patient);
                    onOpenPatientChart(patient);
                  }}
                  className={`rounded-2xl p-3.5 shadow-apple-sm flex items-center justify-between cursor-pointer transition-all border group ${
                    isSelected
                      ? 'bg-[#007AFF]/5 border-[#007AFF] ring-1 ring-[#007AFF]/30'
                      : 'bg-white border-black/5 hover:bg-[#F2F2F7]/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        patient.avatar_url ||
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuBQT6aO4C_m4NbriR87bXfRSNMmR-rpf-JWoKt4ZFzWNtNKGEO_emcIywgRVu5wpWiGBmhJ2tsMCKVdWy_wNtRlGlU29KXuJLJkgl3EaJoZ_OpalP9oj00UIVWgmwVMAn7fweec4XpDLfRUrV8PVV7hU6D00rfgD14OYCAurD1_RzwSwopbfNjsiqEnC8c_Q9KV8uIJXW_cY0zblJRpxmUEP51ehbZrISqXIbtk1KKAbWVzidj3oIQEMg'
                      }
                      alt={patient.full_name}
                      className="w-11 h-11 rounded-full object-cover shrink-0 ring-1 ring-black/10"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-semibold text-[#1C1C1E] truncate group-hover:text-[#007AFF] transition-colors">
                        {patient.full_name}
                      </span>
                      <span className="text-[12px] text-[#636366] truncate">
                        {patient.complaint || 'General consultation'}
                      </span>
                      <span className="text-[10px] font-mono text-[#8E8E93]">
                        {patient.abha_address}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                    {patient.urgency === 'high' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF3B30]/15 text-[#FF3B30] text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]"></span>
                        {t(selectedLanguage, 'urgent')}
                      </span>
                    ) : patient.urgency === 'follow_up' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF9500]/15 text-[#FF9500] text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]"></span>
                        {t(selectedLanguage, 'followUp')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#34C759]/15 text-[#248A3D] text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]"></span>
                        {t(selectedLanguage, 'routine')}
                      </span>
                    )}
                    <span className="text-[10px] text-[#007AFF] font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      <span>{t(selectedLanguage, 'viewChart')}</span>
                      <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Right Column: Selected Patient Quick Preview Inspector (7 cols) */}
        <section className="lg:col-span-7 bg-white rounded-3xl p-6 lg:p-7 shadow-apple-sm border border-black/5 flex flex-col justify-between min-h-[500px]">
          <div className="flex flex-col gap-5">
            {/* Header with Avatar and Listen Pill */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={
                    selectedPatient.avatar_url ||
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuBQT6aO4C_m4NbriR87bXfRSNMmR-rpf-JWoKt4ZFzWNtNKGEO_emcIywgRVu5wpWiGBmhJ2tsMCKVdWy_wNtRlGlU29KXuJLJkgl3EaJoZ_OpalP9oj00UIVWgmwVMAn7fweec4XpDLfRUrV8PVV7hU6D00rfgD14OYCAurD1_RzwSwopbfNjsiqEnC8c_Q9KV8uIJXW_cY0zblJRpxmUEP51ehbZrISqXIbtk1KKAbWVzidj3oIQEMg'
                  }
                  alt={selectedPatient.full_name}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-black/5"
                />
                <div className="flex flex-col">
                  <h3 className="text-2xl font-bold text-[#1C1C1E] tracking-tight leading-tight">
                    {selectedPatient.full_name}
                  </h3>
                  <span className="text-xs text-[#636366] mt-0.5">
                    {[
                      selectedPatient.demographics.age ? `${selectedPatient.demographics.age} yrs` : null,
                      selectedPatient.demographics.gender,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Patient'}
                    {selectedPatient.demographics.district ? ` • ${selectedPatient.demographics.district}` : ''}
                  </span>
                  <span className="text-[11px] font-mono font-medium text-[#8E8E93] mt-1 tracking-wide">
                    ABHA: {selectedPatient.abha_address}
                  </span>
                </div>
              </div>

              {/* Contextual Audio Listen Pill */}
              <button
                onClick={() =>
                  handleAudioListen(
                    `Patient is ${selectedPatient.full_name}, age ${selectedPatient.demographics.age ?? 'not recorded'}. Chief complaint: ${
                      selectedPatient.complaint || 'not recorded'
                    }. Known allergy: ${selectedPatient.allergies?.join(', ') || 'None reported'}. Latest vitals: ${
                      selectedPatient.vitals || 'not recorded'
                    }.`
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E5E5EA]/70 text-[#1C1C1E] hover:bg-[#E5E5EA] text-xs font-semibold transition-all shrink-0 active:scale-95"
              >
                <span className="material-symbols-outlined text-[#007AFF] text-[18px]">volume_up</span>
                <span>{t(selectedLanguage, 'listenSummary')}</span>
              </button>
            </div>

            {/* Condition & Allergy Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] text-xs font-semibold">
                <span className="material-symbols-outlined text-[15px]">emergency</span>
                {selectedPatient.complaint || t(selectedLanguage, 'emergencyComplaint')}
              </span>

              {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF9500]/15 text-[#FF9500] text-xs font-semibold">
                  <span className="material-symbols-outlined text-[15px]">warning</span>
                  {selectedPatient.allergies.join(', ')}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34C759]/15 text-[#248A3D] text-xs font-semibold">
                <span className="material-symbols-outlined text-[15px]">verified</span>
                {t(selectedLanguage, 'abdmVerified')}
              </span>
            </div>

            {/* Inset Metric Panels (Apple Health Style) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F2F2F7] rounded-2xl p-3.5 border border-black/5">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                  {t(selectedLanguage, 'previousVisit')}
                </span>
                <span className="text-[13px] font-semibold text-[#1C1C1E] mt-0.5">14 Sep (Hassan Clinic)</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                  {t(selectedLanguage, 'latestVitals')}
                </span>
                <span className="text-[13px] font-semibold text-[#1C1C1E] mt-0.5">{selectedPatient.vitals || 'Not recorded'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                  {t(selectedLanguage, 'language')}
                </span>
                <span className="text-[13px] font-semibold text-[#1C1C1E] mt-0.5">
                  {selectedPatient.preferred_language === 'kn'
                    ? 'ಕನ್ನಡ (Kannada)'
                    : selectedPatient.preferred_language === 'hi'
                    ? 'हिन्दी (Hindi)'
                    : 'English'}
                </span>
              </div>
            </div>

            {/* Active Medications Preview */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                {t(selectedLanguage, 'activeRxTitle')}
              </span>
              <div className="flex flex-wrap gap-2">
                {(selectedPatient.active_rx || []).map((rx, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-[#F2F2F7] text-xs font-medium text-[#1C1C1E] border border-black/5">
                    💊 {rx}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button Cluster: Open Full Medical Chart + Start Consultation */}
          <div className="pt-5 border-t border-black/5 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => onOpenPatientChart(selectedPatient)}
              className="w-full sm:flex-1 h-12 rounded-xl bg-[#007AFF] text-white text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#0062CC] active:scale-[0.99] transition-all shadow-apple-sm"
            >
              <span className="material-symbols-outlined text-[20px]">assignment</span>
              <span>{t(selectedLanguage, 'openFullChartBtn')}</span>
            </button>

            <button
              onClick={() => onStartConsultation(selectedPatient)}
              className="w-full sm:w-auto px-5 h-12 rounded-xl bg-[#34C759]/15 hover:bg-[#34C759]/25 text-[#248A3D] text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[20px]">videocam</span>
              <span>{t(selectedLanguage, 'callBtn')}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
