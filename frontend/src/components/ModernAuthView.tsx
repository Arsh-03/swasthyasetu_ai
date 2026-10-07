import React, { useState } from 'react';
import type { Language, UserRole, AuthSession } from '../types';
import {
  ShieldCheck, Eye, EyeOff, Sparkles, AlertCircle,
  UserCheck, Stethoscope, ArrowLeft, Globe, Lock
} from 'lucide-react';
import { AbhaCreationModal } from './AbhaCreationModal';

interface ModernAuthViewProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  initialRole: UserRole;
  onLoginSuccess: (session: AuthSession) => void;
  onBackToConsultation?: () => void;
}

// Multilingual Content Dictionary
const AUTH_TRANSLATIONS: Record<Language, {
  appName: string;
  appSub: string;
  patientTagline: string;
  doctorTagline: string;
  complianceBadge: string;
  pageTitleSignIn: string;
  pageTitleSignUp: string;
  pageSubtitle: string;
  rolePatient: string;
  roleDoctor: string;
  formTitleSignInPatient: string;
  formTitleSignInDoctor: string;
  formTitleSignUpPatient: string;
  formTitleSignUpDoctor: string;
  methodIdPatient: string;
  methodIdDoctor: string;
  methodMobile: string;
  nameLabel: string;
  namePlaceholderPatient: string;
  namePlaceholderDoctor: string;
  idLabelPatient: string;
  idLabelDoctor: string;
  idPlaceholderPatient: string;
  idPlaceholderDoctor: string;
  mobileLabel: string;
  mobilePlaceholder: string;
  passwordLabel: string;
  btnSignInPatient: string;
  btnSignInDoctor: string;
  btnSignUpPatient: string;
  btnSignUpDoctor: string;
  btnProcessing: string;
  noAccountPrompt: string;
  hasAccountPrompt: string;
  signUpAction: string;
  loginAction: string;
  quickDemoLabel: string;
  quickDemoPatient: string;
  quickDemoDoctor: string;
  guestLink: string;
}> = {
  en: {
    appName: "CareBridge India",
    appSub: "SwasthyaSetu AI • ABDM v2.4",
    patientTagline: "We at CareBridge are dedicated to safeguarding your health records and privacy under the Ayushman Bharat Digital Mission.",
    doctorTagline: "Providing registered tele-physicians with verified NMC digital tools, AI scribing, and safe clinical decision support.",
    complianceBadge: "DPDP Act 2023 & ABDM Compliant",
    pageTitleSignIn: "Sign in Page",
    pageTitleSignUp: "Sign up Page",
    pageSubtitle: "National Health Authority Telemedicine Gateway",
    rolePatient: "Patient",
    roleDoctor: "Doctor",
    formTitleSignInPatient: "Patient Sign In",
    formTitleSignInDoctor: "Doctor Sign In",
    formTitleSignUpPatient: "Create ABHA Account",
    formTitleSignUpDoctor: "Register Doctor (NMC)",
    methodIdPatient: "🆔 ABHA ID",
    methodIdDoctor: "🩺 Doctor NMC ID",
    methodMobile: "📱 Mobile Number",
    nameLabel: "Full Name:",
    namePlaceholderPatient: "e.g. Ramesh Gowda",
    namePlaceholderDoctor: "e.g. Dr. Ananya Sharma",
    idLabelPatient: "ABHA Address / ID:",
    idLabelDoctor: "Doctor ID / NMC Reg No:",
    idPlaceholderPatient: "91-4820-1928-1120@abdm",
    idPlaceholderDoctor: "NMC-KA-581920",
    mobileLabel: "Mobile Number:",
    mobilePlaceholder: "10-digit mobile number",
    passwordLabel: "Password:",
    btnSignInPatient: "Sign In as Patient",
    btnSignInDoctor: "Sign In to Clinic",
    btnSignUpPatient: "Create ABHA Account",
    btnSignUpDoctor: "Register NMC Doctor",
    btnProcessing: "Verifying credentials...",
    noAccountPrompt: "Don't have an Account?",
    hasAccountPrompt: "Already have an Account?",
    signUpAction: "Sign up",
    loginAction: "Log in",
    quickDemoLabel: "⚡ Quick 1-Click Demo Logins:",
    quickDemoPatient: "Ramesh Gowda (Patient)",
    quickDemoDoctor: "Dr. Ananya Sharma (Doctor)",
    guestLink: "Enter Telehealth Consultation as Guest →"
  },
  kn: {
    appName: "ಕೇರ್‌ಬ್ರಿಡ್ಜ್ ಇಂಡಿಯಾ (CareBridge)",
    appSub: "ಸ್ವಾಸ್ಥ್ಯಸೇತು AI • ABDM v2.4",
    patientTagline: "ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ದಾಖಲೆಗಳನ್ನು ರಕ್ಷಿಸಲು ಮತ್ತು ಗೌಪ್ಯತೆಯನ್ನು ಕಾಪಾಡಲು ಕೇರ್‌ಬ್ರಿಡ್ಜ್ ಸಂಪೂರ್ಣ ಬದ್ಧವಾಗಿದೆ.",
    doctorTagline: "ನೊಂದಾಯಿತ ವೈದ್ಯರಿಗೆ ಎನ್‌ಎಂಸಿ ಡಿಜಿಟಲ್ ಪರಿಕರಗಳು ಮತ್ತು ಸುರಕ್ಷಿತ ಚಿಕಿತ್ಸಾ ನಿರ್ಧಾರ ನೆರವು.",
    complianceBadge: "DPDP ಕಾಯ್ದೆ 2023 & ABDM ಪ್ರಮಾಣೀಕೃತ",
    pageTitleSignIn: "ಲಾಗಿನ್ ಪುಟ (Sign in)",
    pageTitleSignUp: "ನೋಂದಣಿ ಪುಟ (Sign up)",
    pageSubtitle: "ರಾಷ್ಟ್ರೀಯ ಆರೋಗ್ಯ ಪ್ರಾಧಿಕಾರ ಟೆಲಿಮೆಡಿಸಿನ್ ಗೇಟ್‌ವೇ",
    rolePatient: "ರೋಗಿ (Patient)",
    roleDoctor: "ವೈದ್ಯರು (Doctor)",
    formTitleSignInPatient: "ರೋಗಿಗಳ ಲಾಗಿನ್",
    formTitleSignInDoctor: "ವೈದ್ಯರ ಲಾಗಿನ್",
    formTitleSignUpPatient: "ಹೊಸ ABHA ಖಾತೆ ರಚಿಸಿ",
    formTitleSignUpDoctor: "ವೈದ್ಯರ ನೋಂದಣಿ (NMC)",
    methodIdPatient: "🆔 ABHA ವಿಳಾಸ",
    methodIdDoctor: "🩺 ವೈದ್ಯರ NMC ಐಡಿ",
    methodMobile: "📱 ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
    nameLabel: "ಪೂರ್ಣ ಹೆಸರು:",
    namePlaceholderPatient: "ಉದಾ: ರಮೇಶ್ ಗೌಡ",
    namePlaceholderDoctor: "ಉದಾ: ಡಾ. ಅನನ್ಯಾ ಶರ್ಮಾ",
    idLabelPatient: "ABHA ವಿಳಾಸ / ಐಡಿ:",
    idLabelDoctor: "ವೈದ್ಯರ ನೋಂದಣಿ ಸಂಖ್ಯೆ:",
    idPlaceholderPatient: "91-4820-1928-1120@abdm",
    idPlaceholderDoctor: "NMC-KA-581920",
    mobileLabel: "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ:",
    mobilePlaceholder: "10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
    passwordLabel: "ಪಾಸ್‌ವರ್ಡ್:",
    btnSignInPatient: "ರೋಗಿಯಾಗಿ ಲಾಗಿನ್ ಮಾಡಿ",
    btnSignInDoctor: "ಕ್ಲಿನಿಕ್‌ಗೆ ಲಾಗಿನ್ ಮಾಡಿ",
    btnSignUpPatient: "ABHA ಖಾತೆ ಸೃಷ್ಟಿಸಿ",
    btnSignUpDoctor: "ವೈದ್ಯರಾಗಿ ನೋಂದಾಯಿಸಿ",
    btnProcessing: "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...",
    noAccountPrompt: "ಖಾತೆ ಇಲ್ಲವೇ?",
    hasAccountPrompt: "ಈಗಾಗಲೇ ಖಾತೆ ಹೊಂದಿದ್ದೀರಾ?",
    signUpAction: "ನೋಂದಣಿ ಮಾಡಿ",
    loginAction: "ಲಾಗಿನ್ ಮಾಡಿ",
    quickDemoLabel: "⚡ 1-ಕ್ಲಿಕ್ ಡೆಮೊ ಲಾಗಿನ್:",
    quickDemoPatient: "ರಮೇಶ್ ಗೌಡ (ರೋಗಿ)",
    quickDemoDoctor: "ಡಾ. ಅನನ್ಯಾ ಶರ್ಮಾ (ವೈದ್ಯರು)",
    guestLink: "ನೇರವಾಗಿ ಸಮಾಲೋಚನೆ ಕೋಣೆಗೆ ಪ್ರವೇಶಿಸಿ →"
  },
  hi: {
    appName: "केयरब्रिज इंडिया (CareBridge)",
    appSub: "स्वास्थ्यसेतु AI • ABDM v2.4",
    patientTagline: "आयुष्मान भारत डिजिटल मिशन के तहत आपके स्वास्थ्य रिकॉर्ड और निजता की सुरक्षा हमारी सर्वोच्च प्राथमिकता है।",
    doctorTagline: "पंजीकृत टेली-चिकित्सकों के लिए सत्यापित NMC टूल्स, AI स्क्राइब एवं सुरक्षित क्लीनिकल सपोर्ट।",
    complianceBadge: "DPDP अधिनियम 2023 एवं ABDM प्रमाणित",
    pageTitleSignIn: "साइन इन पृष्ठ",
    pageTitleSignUp: "साइन अप पृष्ठ",
    pageSubtitle: "राष्ट्रीय स्वास्थ्य प्राधिकरण टेलीमेडिसिन गेटवे",
    rolePatient: "मरीज़ (Patient)",
    roleDoctor: "डॉक्टर (Doctor)",
    formTitleSignInPatient: "मरीज़ साइन इन",
    formTitleSignInDoctor: "डॉक्टर साइन इन",
    formTitleSignUpPatient: "नया ABHA खाता बनाएं",
    formTitleSignUpDoctor: "डॉक्टर पंजीकरण (NMC)",
    methodIdPatient: "🆔 ABHA आईडी",
    methodIdDoctor: "🩺 डॉक्टर NMC आईडी",
    methodMobile: "📱 मोबाइल नंबर",
    nameLabel: "पूरा नाम:",
    namePlaceholderPatient: "उदा: रमेश गौड़ा",
    namePlaceholderDoctor: "उदा: डॉ. अनन्या शर्मा",
    idLabelPatient: "ABHA पता / आईडी:",
    idLabelDoctor: "डॉक्टर NMC पंजीकरण संख्या:",
    idPlaceholderPatient: "91-4820-1928-1120@abdm",
    idPlaceholderDoctor: "NMC-KA-581920",
    mobileLabel: "मोबाइल नंबर:",
    mobilePlaceholder: "10 अंकों का मोबाइल नंबर",
    passwordLabel: "पासवर्ड:",
    btnSignInPatient: "मरीज़ के रूप में साइन इन करें",
    btnSignInDoctor: "क्लिनिक में साइन इन करें",
    btnSignUpPatient: "ABHA खाता बनाएं",
    btnSignUpDoctor: "NMC डॉक्टर पंजीकृत करें",
    btnProcessing: "सत्यापित किया जा रहा है...",
    noAccountPrompt: "खाता नहीं है?",
    hasAccountPrompt: "पहले से खाता मौजूद है?",
    signUpAction: "साइन अप करें",
    loginAction: "लॉग इन करें",
    quickDemoLabel: "⚡ 1-क्लिक डेमो लॉगिन:",
    quickDemoPatient: "रमेश गौड़ा (मरीज़)",
    quickDemoDoctor: "डॉ. अनन्या शर्मा (डॉक्टर)",
    guestLink: "सीधे परामर्श कक्ष में प्रवेश करें →"
  }
};

export const ModernAuthView: React.FC<ModernAuthViewProps> = ({
  language,
  setLanguage,
  initialRole,
  onLoginSuccess,
  onBackToConsultation
}) => {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [loginMethod, setLoginMethod] = useState<'id' | 'mobile'>('id');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAbhaModalOpen, setIsAbhaModalOpen] = useState<boolean>(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const t = AUTH_TRANSLATIONS[language] || AUTH_TRANSLATIONS.en;

  // Quick Demo Pre-fill
  const handleQuickDemo = (targetRole: UserRole) => {
    setRole(targetRole);
    setIsSignUp(false);
    setError(null);
    if (targetRole === 'patient') {
      setLoginMethod('id');
      setIdentifier('91-4820-1928-1120@abdm');
      setPassword('password123');
    } else {
      setLoginMethod('id');
      setIdentifier('NMC-KA-581920');
      setPassword('password123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSignUp) {
      // REGISTRATION FLOW
      if (!fullName.trim() || !password.trim()) {
        setError("Please enter your full name and password.");
        return;
      }

      setIsLoading(true);
      try {
        if (role === 'patient') {
          const abhaVal = identifier.trim() || `${fullName.toLowerCase().replace(/\s+/g, '')}@abdm`;
          const phoneVal = mobileNumber.trim() || '9900112233';

          const res = await fetch('/api/v1/auth/register/patient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_name: fullName.trim(),
              abha_address: abhaVal.includes('@') ? abhaVal : `${abhaVal}@abdm`,
              mobile_number: phoneVal,
              password: password.trim(),
              preferred_language: language,
              age: 54,
              gender: 'male',
              district: 'Hassan, Karnataka'
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Registration failed.");

          const session: AuthSession = {
            token: data.token,
            role: 'patient',
            user_id: data.user.user_id,
            name: data.user.full_name,
            identifier: data.user.abha_address,
            phone_number: data.user.phone_number,
            preferred_language: data.user.preferred_language
          };
          onLoginSuccess(session);
        } else {
          // Doctor Registration
          const docIdVal = identifier.trim() || `NMC-KA-${Math.floor(100000 + Math.random() * 900000)}`;
          const phoneVal = mobileNumber.trim() || '9888776655';

          const res = await fetch('/api/v1/auth/register/doctor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_name: fullName.trim(),
              registration_number: docIdVal,
              mobile_number: phoneVal,
              password: password.trim(),
              specialty: 'General Medicine',
              qualification: 'MBBS, MD'
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Doctor registration failed.");

          const session: AuthSession = {
            token: data.token,
            role: 'doctor',
            user_id: data.user.user_id,
            name: data.user.display_name,
            identifier: data.user.registration_number,
            phone_number: data.user.phone_number,
            specialty: data.user.specialty
          };
          onLoginSuccess(session);
        }
      } catch (err: any) {
        setError(err.message || "Failed to create account.");
      } finally {
        setIsLoading(false);
      }
    } else {
      // SIGN IN FLOW
      const activeId = loginMethod === 'id' ? identifier.trim() : mobileNumber.trim();
      if (!activeId || !password.trim()) {
        setError("Please enter your login identifier and password.");
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            identifier: activeId,
            password: password.trim()
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Login failed.");

        const session: AuthSession = {
          token: data.token,
          role,
          user_id: data.user.user_id,
          name: role === 'patient' ? data.user.full_name : data.user.display_name,
          identifier: role === 'patient' ? data.user.abha_address : data.user.registration_number,
          phone_number: data.user.phone_number,
          specialty: data.user.specialty,
          preferred_language: data.user.preferred_language
        };
        onLoginSuccess(session);
      } catch (err: any) {
        setError(err.message || "Invalid credentials.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Top Header matching reference image with App Context */}
      <div className="auth-header-top">
        <h1 className="auth-page-title">
          {isSignUp ? t.pageTitleSignUp : t.pageTitleSignIn}
        </h1>
        <p className="auth-page-subtitle">{t.pageSubtitle}</p>
      </div>

      {/* Main Split-Card Container */}
      <div className="auth-master-card">
        {/* Left Illustration & Brand Panel */}
        <div className="auth-left-panel">
          <div>
            {/* App Branding Badge */}
            <div className="auth-brand-badge">
              <div className="auth-badge-icon">
                <ShieldCheck size={24} />
              </div>
              <div className="auth-brand-text">
                <h3 className="auth-brand-title">{t.appName}</h3>
                <span className="auth-brand-subtitle">{t.appSub}</span>
              </div>
            </div>

            <p className="auth-tagline">
              {role === 'patient' ? t.patientTagline : t.doctorTagline}
            </p>
          </div>

          <div className="auth-illustration-container">
            <img
              src="/med_stethoscope_3d.jpg"
              alt="3D Medical Stethoscope on Podium"
              className="auth-illustration-img"
            />
            <div className="auth-trust-pill">
              <Lock size={12} />
              <span>{t.complianceBadge}</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-right-panel">
          {/* Top Meta: Role Switcher & Interactive Language Selector */}
          <div className="auth-top-meta">
            {/* Role Switcher Pill */}
            <div className="auth-role-tabs">
              <button
                type="button"
                className={`auth-role-tab ${role === 'patient' ? 'active' : ''}`}
                onClick={() => {
                  setRole('patient');
                  setError(null);
                  if (!isSignUp && loginMethod === 'id') setIdentifier('91-4820-1928-1120@abdm');
                }}
              >
                <UserCheck size={13} />
                <span>{t.rolePatient}</span>
              </button>
              <button
                type="button"
                className={`auth-role-tab ${role === 'doctor' ? 'active' : ''}`}
                onClick={() => {
                  setRole('doctor');
                  setError(null);
                  if (!isSignUp && loginMethod === 'id') setIdentifier('NMC-KA-581920');
                }}
              >
                <Stethoscope size={13} />
                <span>{t.roleDoctor}</span>
              </button>
            </div>

            {/* Language Selector: Interactive Pills */}
            <div className="auth-lang-pills" title="Select interface language">
              <Globe size={13} className="auth-lang-globe-icon" />
              <button
                type="button"
                className={`auth-lang-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`auth-lang-btn ${language === 'kn' ? 'active' : ''}`}
                onClick={() => setLanguage('kn')}
              >
                ಕನ್ನಡ
              </button>
              <button
                type="button"
                className={`auth-lang-btn ${language === 'hi' ? 'active' : ''}`}
                onClick={() => setLanguage('hi')}
              >
                हिन्दी
              </button>
            </div>
          </div>

          {/* Form Title */}
          <h2 className="auth-form-title">
            {isSignUp
              ? (role === 'patient' ? t.formTitleSignUpPatient : t.formTitleSignUpDoctor)
              : (role === 'patient' ? t.formTitleSignInPatient : t.formTitleSignInDoctor)
            }
          </h2>

          {/* Method Pill Buttons (ABHA/Doctor ID vs Mobile) */}
          <div className="auth-method-buttons">
            <button
              type="button"
              className={`auth-method-pill ${loginMethod === 'id' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('id');
                setError(null);
                if (!isSignUp) {
                  setIdentifier(role === 'patient' ? '91-4820-1928-1120@abdm' : 'NMC-KA-581920');
                }
              }}
            >
              <span>{role === 'patient' ? t.methodIdPatient : t.methodIdDoctor}</span>
            </button>
            <button
              type="button"
              className={`auth-method-pill ${loginMethod === 'mobile' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('mobile');
                setError(null);
                if (!isSignUp) {
                  setMobileNumber(role === 'patient' ? '9845012345' : '9876543210');
                }
              }}
            >
              <span>{t.methodMobile}</span>
            </button>
          </div>

          <div className="auth-divider">
            <span>-OR-</span>
          </div>

          {error && (
            <div className="clinical-alert clinical-alert-danger" style={{ padding: '8px 12px', fontSize: '0.8rem', marginBottom: 12 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {/* No ABHA ID Callout Banner */}
          {role === 'patient' && !isSignUp && (
            <div className="auth-no-abha-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="auth-no-abha-icon">🆔</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
                    No ABHA ID? Create ABHA Card
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 1 }}>
                    Instant e-KYC demo & add your medical history
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 'auto', gap: 4, whiteSpace: 'nowrap' }}
                onClick={() => setIsAbhaModalOpen(true)}
              >
                <Sparkles size={12} />
                <span>Create ABHA</span>
              </button>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="auth-input-group">
                <label className="auth-input-label">{t.nameLabel}</label>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder={role === 'patient' ? t.namePlaceholderPatient : t.namePlaceholderDoctor}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            {loginMethod === 'id' ? (
              <div className="auth-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="auth-input-label">
                    {role === 'patient' ? t.idLabelPatient : t.idLabelDoctor}
                  </label>
                  {role === 'patient' && (
                    <button
                      type="button"
                      onClick={() => setIsAbhaModalOpen(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#5568d7',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: 0
                      }}
                    >
                      <Sparkles size={11} />
                      <span>No ABHA ID?</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder={role === 'patient' ? t.idPlaceholderPatient : t.idPlaceholderDoctor}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="auth-input-group">
                <label className="auth-input-label">{t.mobileLabel}</label>
                <input
                  type="tel"
                  className="auth-input-field"
                  placeholder={t.mobilePlaceholder}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>
            )}

            {isSignUp && loginMethod === 'id' && (
              <div className="auth-input-group">
                <label className="auth-input-label">{t.mobileLabel}</label>
                <input
                  type="tel"
                  className="auth-input-field"
                  placeholder="9900112233"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="auth-input-group auth-password-wrapper">
              <label className="auth-input-label">{t.passwordLabel}</label>
              <input
                type={showPassword ? "text" : "password"}
                className="auth-input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading
                ? t.btnProcessing
                : isSignUp
                  ? (role === 'patient' ? t.btnSignUpPatient : t.btnSignUpDoctor)
                  : (role === 'patient' ? t.btnSignInPatient : t.btnSignInDoctor)
              }
            </button>

            {/* Toggle between Login and Sign Up */}
            <div className="auth-switch-link">
              {isSignUp ? (
                <span>
                  {t.hasAccountPrompt}
                  <button type="button" onClick={() => { setIsSignUp(false); setError(null); }}>
                    {t.loginAction}
                  </button>
                </span>
              ) : (
                <span>
                  {t.noAccountPrompt}
                  <button type="button" onClick={() => { setIsSignUp(true); setError(null); }}>
                    {t.signUpAction}
                  </button>
                </span>
              )}
            </div>

            {/* Quick Demo Pre-fills */}
            <div className="auth-demo-bar">
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: 8 }}>
                {t.quickDemoLabel}
              </span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto', background: '#f8fafc' }}
                  onClick={() => handleQuickDemo('patient')}
                >
                  <Sparkles size={12} color="#5568d7" />
                  <span>{t.quickDemoPatient}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto', background: '#f8fafc' }}
                  onClick={() => handleQuickDemo('doctor')}
                >
                  <Sparkles size={12} color="#0d9488" />
                  <span>{t.quickDemoDoctor}</span>
                </button>
              </div>
            </div>

            {onBackToConsultation && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button
                  type="button"
                  onClick={onBackToConsultation}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'color 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#5568d7')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
                >
                  <ArrowLeft size={13} />
                  <span>{t.guestLink}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Official/Demo ABHA Creation & Medical History Modal */}
      <AbhaCreationModal
        isOpen={isAbhaModalOpen}
        onClose={() => setIsAbhaModalOpen(false)}
        language={language}
        onSuccess={(session) => {
          setIsAbhaModalOpen(false);
          onLoginSuccess(session);
        }}
      />
    </div>
  );
};

