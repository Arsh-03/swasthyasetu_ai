import React from 'react';
import type { DoctorProfile } from '../services/api';
import { t, type SupportedLanguage } from '../utils/translations';

const LANGUAGES: SupportedLanguage[] = ['en', 'kn', 'hi'];
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिंदी' };

// Stacks every language's version of a label in one grid cell and shows only
// the active one, so the element is always as wide as its longest translation
// and the navbar doesn't shift when the language changes.
const StableLabel: React.FC<{ lang: SupportedLanguage; text: (l: SupportedLanguage) => string; className?: string }> = ({
  lang,
  text,
  className = '',
}) => (
  <span className={`inline-grid ${className}`}>
    {LANGUAGES.map((l) => (
      <span
        key={l}
        aria-hidden={l !== lang}
        className={`[grid-area:1/1] whitespace-nowrap ${l === lang ? '' : 'invisible'}`}
      >
        {text(l)}
      </span>
    ))}
  </span>
);

interface DoctorHeaderProps {
  activeTab: 'patient-queue' | 'patient-chart' | 'active-consultation' | 'clinical-records' | 'audit-trail';
  setActiveTab: (tab: 'patient-queue' | 'patient-chart' | 'active-consultation' | 'clinical-records' | 'audit-trail') => void;
  doctor: DoctorProfile | null;
  selectedLanguage: SupportedLanguage;
  setSelectedLanguage: (lang: SupportedLanguage) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onLogout?: () => void;
  selectedPatientName?: string;
  isCallActive?: boolean;
  onReturnToCall?: () => void;
}

export const DoctorHeader: React.FC<DoctorHeaderProps> = ({
  activeTab,
  setActiveTab,
  doctor,
  selectedLanguage,
  setSelectedLanguage,
  searchQuery,
  setSearchQuery,
  onLogout,
  selectedPatientName,
  isCallActive,
  onReturnToCall,
}) => {
  // e.g. "Dr. Ananya Sharma" -> short "Dr. Ananya", initials "AS"
  const nameParts = (doctor?.display_name || '').replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean);
  const doctorShortName = nameParts.length ? `Dr. ${nameParts[0]}` : '…';
  const doctorInitials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : (nameParts[0]?.[0] || 'D').toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 liquid-glass-toolbar shadow-apple-sm transition-all duration-200">
      <div className="h-16 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        {/* Brand & macOS Segmented Tab Navigation */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            onClick={() => setActiveTab('patient-queue')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-apple-sm ring-1 ring-white/30 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-white text-[20px]">health_and_safety</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-[#1C1C1E] tracking-tight leading-none">
                SwasthyaSetu
              </span>
              <span className="text-[10px] font-medium text-[#8E8E93] uppercase tracking-wider mt-0.5">
                <StableLabel lang={selectedLanguage} text={(l) => t(l, 'clinicianStudio')} />
              </span>
            </div>
          </div>

          {/* macOS Style Segmented Control (Localized) */}
          <nav className="hidden md:flex items-center p-1 rounded-xl bg-[#E5E5EA]/70 ring-1 ring-black/5">
            <button
              onClick={() => setActiveTab('patient-queue')}
              className={`px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition-all ${
                activeTab === 'patient-queue'
                  ? 'bg-white text-[#1C1C1E] shadow-apple-sm font-semibold'
                  : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'patientQueue')} />
            </button>

            <button
              onClick={() => setActiveTab('patient-chart')}
              className={`px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'patient-chart'
                  ? 'bg-white text-[#1C1C1E] shadow-apple-sm font-semibold'
                  : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'patientChart')} />
              {selectedPatientName && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] max-w-[90px] truncate">
                  {selectedPatientName.split(' ')[0]}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('clinical-records')}
              className={`px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition-all ${
                activeTab === 'clinical-records'
                  ? 'bg-white text-[#1C1C1E] shadow-apple-sm font-semibold'
                  : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'clinicalRecords')} />
            </button>

            <button
              onClick={() => setActiveTab('audit-trail')}
              className={`px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition-all ${
                activeTab === 'audit-trail'
                  ? 'bg-white text-[#1C1C1E] shadow-apple-sm font-semibold'
                  : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'auditTrail')} />
            </button>
          </nav>
        </div>

        {/* Global Apple Search Field */}
        <div className="flex-1 max-w-xs hidden xl:block">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-2.5 text-[#8E8E93] text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(selectedLanguage, 'searchPlaceholder')}
              className="w-full h-8 pl-8 pr-8 rounded-lg bg-[#E5E5EA]/60 hover:bg-[#E5E5EA]/90 focus:bg-white text-[#1C1C1E] placeholder:text-[#8E8E93] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] border border-transparent transition-all"
            />
            <kbd className="absolute right-2 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#8E8E93] bg-white/70 border border-black/5 shadow-xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right Action Cluster: Active Call return indicator, Language Switcher, Clinician Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Active Call Floating Return Pill (if call in progress while viewing chart/records) */}
          {isCallActive && activeTab !== 'active-consultation' && onReturnToCall && (
            <button
              onClick={onReturnToCall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34C759] hover:bg-[#2FB350] text-white text-xs font-semibold shadow-apple-sm animate-pulse active:scale-95 transition-all"
              title="Return to Ongoing Consultation"
            >
              <span className="material-symbols-outlined text-[15px]">call</span>
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'activeCall')} className="hidden sm:inline-grid" />
            </button>
          )}

          {/* Vernacular Indic / English Switcher Pill */}
          <button
            onClick={() => setSelectedLanguage(selectedLanguage === 'en' ? 'kn' : selectedLanguage === 'kn' ? 'hi' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#E5E5EA]/70 hover:bg-[#E5E5EA] text-[#1C1C1E] ring-1 ring-black/5 transition-all cursor-pointer"
            title="Switch Language"
          >
            <StableLabel lang={selectedLanguage} text={(l) => LANGUAGE_NAMES[l]} className="text-[13px] font-medium" />
            <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-white font-mono text-[#636366]">
              {selectedLanguage}
            </span>
          </button>

          {/* Clinician Monogram Pill with Duty Tag */}
          <div className="flex items-center gap-2 pl-2 border-l border-black/10">
            <div className="flex items-center gap-2.5 py-1 px-2.5 rounded-full bg-white/90 border border-black/5 shadow-apple-sm">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white text-[11px] font-semibold flex items-center justify-center ring-1 ring-black/10 shrink-0 shadow-xs">
                {doctorInitials}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-[#1C1C1E] leading-none">
                    {doctorShortName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                      isCallActive
                        ? 'bg-[#007AFF]/15 text-[#007AFF]'
                        : 'bg-[#34C759]/15 text-[#248A3D]'
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isCallActive ? 'bg-[#007AFF] animate-ping' : 'bg-[#34C759]'
                      }`}
                    ></span>
                    <StableLabel
                      lang={selectedLanguage}
                      text={(l) => (isCallActive ? t(l, 'inCall') : t(l, 'available'))}
                    />
                  </span>
                </div>
                <span className="text-[10px] text-[#8E8E93] leading-none mt-0.5 font-mono">
                  {doctor?.registration_number || ''}
                </span>
              </div>
            </div>

            {/* Logout Action Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-7 h-7 rounded-full bg-[#E5E5EA]/70 hover:bg-[#FF3B30]/10 text-[#8E8E93] hover:text-[#FF3B30] flex items-center justify-center transition-colors ring-1 ring-black/5 active:scale-95 cursor-pointer"
                title={t(selectedLanguage, 'signOut')}
              >
                <span className="material-symbols-outlined text-[15px]">logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
