import React, { useState, useEffect, useRef } from 'react';
import type { DoctorProfile } from '../services/api';
import { t, type SupportedLanguage, stripNonLatinParentheses } from '../utils/translations';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  kn: 'ಕನ್ನಡ',
  hi: 'हिंदी',
};

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
  const [isMac] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    const platform =
      (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent ||
      '';
    return /(Mac|iPhone|iPod|iPad)/i.test(platform);
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K shortcut listener to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // e.g. "Dr. Ananya Sharma" -> short "Dr. Ananya"
  const cleanDisplayName = doctor?.display_name
    ? (selectedLanguage === 'en' ? stripNonLatinParentheses(doctor.display_name) : doctor.display_name)
    : 'Dr. Doctor';
  const nameParts = cleanDisplayName.replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean);
  const doctorShortName = nameParts.length ? `Dr. ${nameParts[0]}` : cleanDisplayName;

  const shortcutHint = isMac ? '⌘K' : 'Ctrl K';

  return (
    <header className="w-full h-14 shrink-0 glass-toolbar border-b border-card-border z-30 transition-all duration-200">
      <div className="h-14 w-full px-4 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Logo + SwasthyaSetu */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer select-none group text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
            onClick={() => setActiveTab('patient-queue')}
            title="SwasthyaSetu - Patient Queue"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-ink flex items-center justify-center shadow-xs ring-1 ring-white/30 group-hover:scale-105 transition-transform">
              <Icon name="brand" size={18} tone="onPrimary" weight="duotone" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-ink tracking-tight leading-tight">
                SwasthyaSetu
              </span>
              <span className="text-4xs font-medium text-ink-muted uppercase tracking-wider leading-none">
                Clinician
              </span>
            </span>
          </button>
        </div>

        {/* Center: Global Search with Platform Shortcut Hint */}
        <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2 sm:mx-4 flex justify-center">
          <div className="relative w-full flex items-center">
            <Icon
              name="search"
              size={15}
              tone="muted"
              weight="duotone"
              className="absolute left-2.5 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(selectedLanguage, 'searchPlaceholder')}
              aria-label={t(selectedLanguage, 'searchPlaceholder')}
              className="w-full h-8 pl-8 pr-14 rounded-lg bg-fog/50 hover:bg-fog/80 focus:bg-card text-ink placeholder:text-ink-muted text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary border border-ink/5 transition-all"
            />
            <kbd
              aria-hidden="true"
              className="absolute right-2 px-1.5 py-0.5 rounded text-4xs font-mono font-medium text-ink-muted bg-card border border-ink/10 shadow-2xs pointer-events-none select-none"
            >
              {shortcutHint}
            </kbd>
          </div>
        </div>

        {/* Right: Call return pill, Language toggle, Doctor info, Menu dropdown */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Active Call Floating Return Pill (if call in progress) */}
          {isCallActive && activeTab !== 'active-consultation' && onReturnToCall && (
            <button
              type="button"
              onClick={onReturnToCall}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-success-deep hover:bg-success-pressed text-white text-xs font-semibold shadow-2xs animate-pulse active:scale-95 transition-all cursor-pointer"
              title="Return to Ongoing Consultation"
            >
              <Icon name="call" size={13} />
              <span className="hidden sm:inline text-xs">
                {selectedPatientName ? `${t(selectedLanguage, 'activeCall')} (${selectedPatientName})` : t(selectedLanguage, 'activeCall')}
              </span>
            </button>
          )}

          {/* Language Toggle Pill */}
          <button
            type="button"
            onClick={() =>
              setSelectedLanguage(
                selectedLanguage === 'en' ? 'kn' : selectedLanguage === 'kn' ? 'hi' : 'en'
              )
            }
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-fog/60 hover:bg-fog text-ink border border-ink/5 transition-all cursor-pointer"
            title="Switch Language"
            aria-label={`Switch language (${LANGUAGE_NAMES[selectedLanguage]})`}
          >
            <span className="font-medium text-xs">{LANGUAGE_NAMES[selectedLanguage]}</span>
            <span className="text-4xs uppercase px-1 py-0.5 rounded bg-card font-mono text-ink-muted border border-ink/5">
              {selectedLanguage}
            </span>
          </button>

          {/* Doctor Monogram & Name Pill */}
          <div
            className="flex items-center gap-2 py-0.5 px-2 rounded-full bg-card/80 border border-ink/5 shadow-2xs"
            title={doctor ? `${cleanDisplayName} · ${doctor.registration_number}` : undefined}
          >
            <Avatar name={cleanDisplayName} size={26} domain="privacy" />
            <span className="text-xs font-semibold text-ink leading-tight hidden lg:inline truncate max-w-[120px]">
              {doctorShortName}
            </span>
          </div>

          {/* Dropdown Menu (Kebab) */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
              className="w-8 h-8 rounded-lg bg-fog/60 hover:bg-fog text-ink-muted hover:text-ink flex items-center justify-center border border-ink/5 transition-colors cursor-pointer"
              title="More options"
              aria-label="More options"
            >
              <Icon name="menu" size={17} />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-card border border-ink/10 shadow-lg p-1.5 z-50">
                <div className="px-3 py-2 border-b border-ink/5">
                  <p className="text-xs font-bold text-ink leading-tight truncate">
                    {cleanDisplayName}
                  </p>
                  <p className="text-3xs text-ink-muted font-mono mt-0.5">
                    {doctor?.registration_number || 'KMC-84920'}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-4xs font-medium text-success-deep">
                    <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                    <span>{t(selectedLanguage, 'available')}</span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('audit-trail');
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink hover:bg-base rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <Icon name="shieldCheck" size={15} tone="navy" />
                    <span>{t(selectedLanguage, 'auditTrail')}</span>
                  </button>
                </div>

                {onLogout && (
                  <div className="pt-1 border-t border-ink/5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-danger-deep hover:bg-danger-tint rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <Icon name="signOut" size={15} tone="danger" />
                      <span>{t(selectedLanguage, 'signOut')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
