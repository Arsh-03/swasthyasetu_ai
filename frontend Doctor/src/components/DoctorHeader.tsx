import React from 'react';
import type { DoctorProfile } from '../services/api';
import { t, type SupportedLanguage } from '../utils/translations';
import { Icon } from './ui/Icon';

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
        lang={l}
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
    <header className="fixed top-0 left-0 right-0 z-50 glass-toolbar shadow-sm transition-all duration-200">
      <div className="h-16 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        {/* Brand & macOS Segmented Tab Navigation */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0">
          <button
            type="button"
            className="flex items-center gap-2.5 cursor-pointer select-none group text-left rounded-xl"
            onClick={() => setActiveTab('patient-queue')}
          >
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-ink flex items-center justify-center shadow-sm ring-1 ring-white/30 group-hover:scale-105 transition-transform">
              <Icon name="brand" size={20} tone="onPrimary" weight="duotone" />
            </span>
            <span className="flex flex-col">
              <span className="text-subhead font-semibold text-ink tracking-tight leading-none">
                SwasthyaSetu
              </span>
              <span className="text-3xs font-medium text-ink-muted uppercase tracking-wider mt-0.5">
                <StableLabel lang={selectedLanguage} text={(l) => t(l, 'clinicianStudio')} />
              </span>
            </span>
          </button>

          {/* macOS Style Segmented Control (Localized) */}
          <nav className="hidden md:flex items-center p-1 rounded-xl bg-fog/40 ring-1 ring-ink/5">
            <button
              onClick={() => setActiveTab('patient-queue')}
              aria-current={activeTab === 'patient-queue' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-[9px] text-footnote font-medium transition-all ${
                activeTab === 'patient-queue'
                  ? 'bg-card text-ink shadow-sm font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'patientQueue')} />
            </button>

            <button
              onClick={() => setActiveTab('patient-chart')}
              aria-current={activeTab === 'patient-chart' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-[9px] text-footnote font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'patient-chart'
                  ? 'bg-card text-ink shadow-sm font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'patientChart')} />
              {selectedPatientName && (
                <span className="text-3xs px-1.5 py-0.5 rounded-full bg-primary-tint text-primary max-w-[90px] truncate">
                  {selectedPatientName.split(' ')[0]}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('clinical-records')}
              aria-current={activeTab === 'clinical-records' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-[9px] text-footnote font-medium transition-all ${
                activeTab === 'clinical-records'
                  ? 'bg-card text-ink shadow-sm font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'clinicalRecords')} />
            </button>

            <button
              onClick={() => setActiveTab('audit-trail')}
              aria-current={activeTab === 'audit-trail' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-[9px] text-footnote font-medium transition-all ${
                activeTab === 'audit-trail'
                  ? 'bg-card text-ink shadow-sm font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/5'
              }`}
            >
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'auditTrail')} />
            </button>
          </nav>
        </div>

        {/* Global Apple Search Field */}
        <div className="flex-1 max-w-xs hidden xl:block">
          <div className="relative flex items-center">
            <Icon name="search" size={18} tone="muted" weight="duotone" className="absolute left-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(selectedLanguage, 'searchPlaceholder')}
              aria-label={t(selectedLanguage, 'searchPlaceholder')}
              className="w-full h-8 pl-8 pr-8 rounded-lg bg-fog/40 hover:bg-fog/60 focus:bg-card text-ink placeholder:text-ink-muted text-footnote focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary border border-transparent transition-all"
            />
            <kbd aria-hidden className="absolute right-2 px-1.5 py-0.5 rounded text-3xs font-mono text-ink-muted bg-white/70 border border-ink/5 shadow-xs">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-deep hover:bg-success-pressed text-white text-xs font-semibold shadow-sm animate-pulse active:scale-95 transition-all"
              title="Return to Ongoing Consultation"
            >
              <Icon name="call" size={15} />
              <StableLabel lang={selectedLanguage} text={(l) => t(l, 'activeCall')} className="hidden sm:inline-grid" />
            </button>
          )}

          {/* Vernacular Indic / English Switcher Pill */}
          <button
            onClick={() => setSelectedLanguage(selectedLanguage === 'en' ? 'kn' : selectedLanguage === 'kn' ? 'hi' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-fog/70 hover:bg-fog text-ink ring-1 ring-ink/5 transition-all cursor-pointer"
            title="Switch Language"
            aria-label={`Switch language (${LANGUAGE_NAMES[selectedLanguage]})`}
          >
            <StableLabel lang={selectedLanguage} text={(l) => LANGUAGE_NAMES[l]} className="text-footnote font-medium" />
            <span className="text-4xs uppercase px-1 py-0.5 rounded bg-card font-mono text-ink-muted">
              {selectedLanguage}
            </span>
          </button>

          {/* Clinician Monogram Pill with Duty Tag */}
          <div className="flex items-center gap-2 pl-2 border-l border-ink/10">
            {/* Below 1536px only the initials avatar shows (the name stays available to screen readers) so the header fits from 1280px in every language */}
            <div
              className="flex items-center gap-2.5 py-1 px-2.5 max-2xl:px-1 rounded-full bg-white/90 border border-ink/5 shadow-sm"
              title={doctor ? `${doctor.display_name} · ${doctor.registration_number}` : undefined}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-ink text-white text-2xs font-semibold flex items-center justify-center ring-1 ring-ink/10 shrink-0 shadow-xs">
                {doctorInitials}
              </div>
              <div className="flex flex-col text-left max-2xl:sr-only">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-ink leading-none">
                    {doctorShortName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-4xs font-medium ${
                      isCallActive
                        ? 'bg-primary-tint text-primary'
                        : 'bg-success-tint text-success-deep'
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isCallActive ? 'bg-primary animate-ping' : 'bg-success'
                      }`}
                    ></span>
                    <StableLabel
                      lang={selectedLanguage}
                      text={(l) => (isCallActive ? t(l, 'inCall') : t(l, 'available'))}
                    />
                  </span>
                </div>
                <span className="text-3xs text-ink-muted leading-none mt-0.5 font-mono">
                  {doctor?.registration_number || ''}
                </span>
              </div>
            </div>

            {/* Logout Action Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-7 h-7 rounded-full bg-fog/70 hover:bg-danger-tint text-ink-muted hover:text-danger-deep flex items-center justify-center transition-colors ring-1 ring-ink/5 active:scale-95 cursor-pointer"
                title={t(selectedLanguage, 'signOut')}
                aria-label={t(selectedLanguage, 'signOut')}
              >
                <Icon name="signOut" size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
