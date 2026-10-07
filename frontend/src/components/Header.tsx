import React from 'react';
import type { Language, UserRole, AuthSession } from '../types';
import { translations } from '../translations';
import { ShieldCheck, Globe, UserCheck, Stethoscope, FileText, LogOut, LogIn, CheckCircle } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  language: Language;
  setLanguage: (lang: Language) => void;
  onOpenAuditLogs: () => void;
  session: AuthSession | null;
  onSignOut: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  language,
  setLanguage,
  onOpenAuditLogs,
  session,
  onSignOut,
  onOpenAuth
}) => {
  const t = translations[language];

  return (
    <>
      <div className="top-tricolor-bar" />
      <header className="app-header-modern">
        <div className="header-modern-inner">
          {/* 1. Left: Brand & ABDM Certification Badge */}
          <div className="modern-brand-group">
            <div className="modern-brand-icon">
              <ShieldCheck size={22} />
            </div>
            <div className="modern-brand-text">
              <div className="modern-brand-title-row">
                <span className="modern-brand-title">CareBridge India</span>
                <span className="modern-abdm-chip">ABDM v2.4</span>
              </div>
              <span className="modern-brand-tagline">
                SwasthyaSetu AI • Telemedicine & Consent Layer
              </span>
            </div>
          </div>

          {/* 2. Center: Authenticated Portal Role Badge (Role-Locked & Cryptographically Verified) */}
          <div
            className="modern-role-locked-badge"
            title="Active session is role-locked under ABDM & DPDP Act 2023. Cross-role switching is strictly blocked. To change roles, sign out and authenticate."
          >
            {currentRole === 'patient' ? (
              <div className="role-locked-pill patient">
                <span className="role-locked-pulse patient" />
                <UserCheck size={16} />
                <span className="role-locked-title">{t.rolePatient}</span>
                <span className="role-locked-tag">ABHA Verified</span>
              </div>
            ) : (
              <div className="role-locked-pill doctor">
                <span className="role-locked-pulse doctor" />
                <Stethoscope size={16} />
                <span className="role-locked-title">{t.roleDoctor}</span>
                <span className="role-locked-tag">NMC Verified</span>
              </div>
            )}
          </div>

          {/* 3. Right: Utility Controls & User Profile */}
          <div className="modern-header-actions">
            {/* Language Switcher Pills */}
            <div className="modern-lang-group" title="Select display language">
              <Globe size={13} className="modern-lang-globe" />
              <button
                type="button"
                className={`modern-lang-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`modern-lang-btn ${language === 'kn' ? 'active' : ''}`}
                onClick={() => setLanguage('kn')}
                style={{ fontFamily: 'Noto Sans Kannada, sans-serif' }}
              >
                ಕನ್ನಡ
              </button>
              <button
                type="button"
                className={`modern-lang-btn ${language === 'hi' ? 'active' : ''}`}
                onClick={() => setLanguage('hi')}
                style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}
              >
                हिन्दी
              </button>
            </div>

            {/* DPDP Cryptographic Audit Trail Button */}
            <button
              type="button"
              className="modern-audit-btn"
              onClick={onOpenAuditLogs}
              title="View DPDP Act 2023 Cryptographic Audit Trail"
            >
              <FileText size={14} />
              <span>{t.auditLogsBtn}</span>
            </button>

            {/* Active User Session Avatar or Auth Trigger */}
            {session ? (
              <div className="modern-user-chip">
                <div className="modern-user-avatar">
                  {session.role === 'patient' ? '🧑‍🌾' : '👩‍⚕️'}
                </div>
                <div className="modern-user-info">
                  <div className="modern-user-name">
                    <CheckCircle size={11} color="#16a34a" />
                    <span>{session.name.split(' ')[0]}</span>
                  </div>
                  <span className="modern-user-id">
                    {session.role === 'patient' ? 'ABHA' : 'NMC Reg'}
                  </span>
                </div>
                <button
                  type="button"
                  className="modern-signout-btn"
                  onClick={onSignOut}
                  title="Sign out of account"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', minHeight: 'auto' }}
                onClick={onOpenAuth}
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

