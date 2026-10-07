import React, { useState } from 'react';
import type { Language, AuthSession, HealthRecord } from '../types';
import {
  ShieldCheck, CheckCircle2, QrCode,
  Download, Printer, ArrowRight, ArrowLeft, X, Sparkles,
  AlertCircle, ExternalLink, Heart, Pill, AlertTriangle,
  FileText, Check, Copy, Lock, RefreshCw, Activity
} from 'lucide-react';

interface AbhaCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onSuccess: (session: AuthSession, initialRecord?: HealthRecord) => void;
}

type WizardStep = 'method' | 'otp' | 'profile' | 'card' | 'medical_history';

const COMMON_CONDITIONS = [
  "Diabetes Type 2",
  "Hypertension (High BP)",
  "Kidney Stones (Colic)",
  "Asthma / Respiratory",
  "Thyroid Disorder",
  "Heart Condition",
  "Gastritis / GERD",
  "None / Healthy"
];

const COMMON_ALLERGIES = [
  "Penicillin",
  "Sulfa Antibiotics",
  "Aspirin / NSAIDs",
  "Dust & Pollen",
  "Peanuts / Food Allergy",
  "Latex",
  "No Known Allergies"
];

const COMMON_SURGERIES = [
  "Appendectomy",
  "Gallbladder Surgery",
  "Fracture Fixation",
  "Cesarean Section",
  "Hernia Repair",
  "None"
];

export const AbhaCreationModal: React.FC<AbhaCreationModalProps> = ({
  isOpen,
  onClose,
  language,
  onSuccess
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<WizardStep>('method');

  // Step 1: Method
  const [authMethod, setAuthMethod] = useState<'aadhaar' | 'mobile' | 'license'>('aadhaar');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(true);

  // Step 2: OTP
  const [otpCode, setOtpCode] = useState('');
  const timer = 48;

  // Step 3: Demographics & ABHA
  const [fullName, setFullName] = useState('Kavita Rao');
  const [age, setAge] = useState(38);
  const [gender, setGender] = useState('female');
  const [mobileNumber, setMobileNumber] = useState('9845213456');
  const [stateName, setStateName] = useState('Karnataka');
  const [district, setDistrict] = useState('Bengaluru');
  const [customAbhaHandle, setCustomAbhaHandle] = useState('kavita.rao');
  const [password, setPassword] = useState('password123');

  // Generated ABHA details
  const [generatedAbhaNumber, setGeneratedAbhaNumber] = useState('91-8420-1928-3341');
  const [copiedAbha, setCopiedAbha] = useState(false);

  // Step 5: Medical History
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState('');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [selectedSurgeries, setSelectedSurgeries] = useState<string[]>([]);
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [currentMeds, setCurrentMeds] = useState<string[]>([]);
  const [newMedInput, setNewMedInput] = useState('');

  // Initial Record Upload (optional)
  const [includeRecord, setIncludeRecord] = useState(false);
  const [recordTitle, setRecordTitle] = useState('Previous Abdominal & Renal Ultrasound Report');
  const [recordType, setRecordType] = useState('ultrasound');
  const [recordFindings, setRecordFindings] = useState('Kidneys normal in size and echotexture. No hydronephrosis.');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-format Aadhaar
  const handleAadhaarChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 12);
    let formatted = '';
    for (let i = 0; i < raw.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += raw[i];
    }
    setAadhaarNumber(formatted);
  };

  const handleDemoFillAadhaar = () => {
    setAadhaarNumber('5419 8201 3920');
    setConsentAgreed(true);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (authMethod === 'aadhaar' && aadhaarNumber.replace(/\s/g, '').length < 12) {
      setErrorMessage("Please enter a valid 12-digit Aadhaar number.");
      return;
    }
    if (!consentAgreed) {
      setErrorMessage("You must accept the Aadhaar e-KYC consent terms.");
      return;
    }
    setStep('otp');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (otpCode.length < 6) {
      setErrorMessage("Please enter the 6-digit OTP code.");
      return;
    }
    // Generate random realistic 14-digit ABHA Number
    const p1 = Math.floor(1000 + Math.random() * 9000);
    const p2 = Math.floor(1000 + Math.random() * 9000);
    const p3 = Math.floor(1000 + Math.random() * 9000);
    const newNumber = `91-${p1}-${p2}-${p3}`;
    setGeneratedAbhaNumber(newNumber);
    setStep('profile');
  };

  const handleGenerateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !customAbhaHandle.trim()) {
      setErrorMessage("Please enter your name and choose an ABHA handle.");
      return;
    }
    setStep('card');
  };

  const handleCopyAbha = () => {
    navigator.clipboard?.writeText(generatedAbhaNumber);
    setCopiedAbha(true);
    setTimeout(() => setCopiedAbha(false), 2000);
  };

  const toggleCondition = (cond: string) => {
    setSelectedConditions(prev =>
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  const addCustomCondition = () => {
    if (customCondition.trim() && !selectedConditions.includes(customCondition.trim())) {
      setSelectedConditions(prev => [...prev, customCondition.trim()]);
      setCustomCondition('');
    }
  };

  const toggleAllergy = (alg: string) => {
    setSelectedAllergies(prev =>
      prev.includes(alg) ? prev.filter(a => a !== alg) : [...prev, alg]
    );
  };

  const addCustomAllergy = () => {
    if (customAllergy.trim() && !selectedAllergies.includes(customAllergy.trim())) {
      setSelectedAllergies(prev => [...prev, customAllergy.trim()]);
      setCustomAllergy('');
    }
  };

  const toggleSurgery = (surg: string) => {
    setSelectedSurgeries(prev =>
      prev.includes(surg) ? prev.filter(s => s !== surg) : [...prev, surg]
    );
  };

  const addMedication = () => {
    if (newMedInput.trim() && !currentMeds.includes(newMedInput.trim())) {
      setCurrentMeds(prev => [...prev, newMedInput.trim()]);
      setNewMedInput('');
    }
  };

  const removeMedication = (idx: number) => {
    setCurrentMeds(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAndComplete = async (skipMedHistory: boolean = false) => {
    setIsLoading(true);
    setErrorMessage(null);

    const abhaAddress = `${customAbhaHandle.trim().toLowerCase().replace(/@.*$/, '')}@abdm`;
    const last4 = aadhaarNumber.replace(/\s/g, '').slice(-4) || '9821';

    const medicalHistoryPayload = skipMedHistory ? {
      chronic_conditions: [],
      current_medications: [],
      allergies: [],
      surgeries: [],
      blood_group: bloodGroup
    } : {
      chronic_conditions: selectedConditions,
      current_medications: currentMeds,
      allergies: selectedAllergies,
      surgeries: selectedSurgeries,
      blood_group: bloodGroup
    };

    const initialRecordPayload = (includeRecord && !skipMedHistory && recordTitle.trim()) ? {
      title: recordTitle.trim(),
      record_type: recordType,
      date_str: "2026-09-15",
      summary_findings: recordFindings.trim(),
      raw_preview_text: `ABDM e-Vault Record for ${fullName}: ${recordTitle}. Findings: ${recordFindings}`
    } : null;

    try {
      const res = await fetch('/api/v1/auth/create-abha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          abha_number: generatedAbhaNumber,
          abha_address: abhaAddress,
          mobile_number: mobileNumber.trim(),
          password: password.trim() || 'password123',
          preferred_language: language,
          age: Number(age) || 35,
          gender,
          district: `${district}, ${stateName}`,
          auth_method: authMethod,
          aadhaar_last4: last4,
          medical_history: medicalHistoryPayload,
          initial_record: initialRecordPayload
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create ABHA account.");
      }

      const newSession: AuthSession = {
        token: data.token,
        role: 'patient',
        user_id: data.user.user_id,
        name: data.user.full_name,
        identifier: data.user.abha_address,
        phone_number: data.user.phone_number,
        preferred_language: data.user.preferred_language
      };

      let createdRecord: HealthRecord | undefined = undefined;
      if (initialRecordPayload) {
        createdRecord = {
          record_id: `rec_${Date.now()}`,
          patient_id: data.user.user_id,
          record_type: recordType,
          title: recordTitle,
          date_str: "15 Sep 2026",
          file_mime_type: "application/pdf",
          file_size_bytes: 1850000,
          summary_findings: recordFindings,
          consent_status: 'approved'
        };
      }

      onSuccess(newSession, createdRecord);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong while provisioning ABHA.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="abha-modal-overlay">
      <div className="abha-modal-dialog">
        {/* Top Government Tricolor Bar */}
        <div className="top-tricolor-bar" />

        {/* Modal Header */}
        <div className="abha-modal-header">
          <div className="abha-modal-brand">
            <div className="abha-emblem-badge">
              <ShieldCheck size={22} color="#ffffff" />
            </div>
            <div>
              <div className="abha-brand-title-row">
                <h3 className="abha-header-title">National Health Authority (NHA)</h3>
                <span className="abha-nha-pill">Government of India</span>
              </div>
              <p className="abha-header-subtitle">
                Ayushman Bharat Digital Mission (ABDM) • Create ABHA ID
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Official External Link */}
            <a
              href="https://abha.abdm.gov.in/abha/v3/register"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{
                fontSize: '0.75rem',
                padding: '5px 10px',
                minHeight: 'auto',
                gap: 5,
                background: '#f8fafc',
                textDecoration: 'none',
                color: '#1e293b'
              }}
              title="Open Official Central Government ABHA Portal"
            >
              <span>Official Govt Portal (External)</span>
              <ExternalLink size={12} />
            </a>

            <button
              type="button"
              className="abha-close-btn"
              onClick={onClose}
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="abha-stepper-bar">
          <div className={`abha-step-item ${step === 'method' ? 'active' : 'done'}`}>
            <span className="step-num">1</span>
            <span className="step-label">e-KYC Method</span>
          </div>
          <div className="abha-step-line" />
          <div className={`abha-step-item ${step === 'otp' ? 'active' : ['profile', 'card', 'medical_history'].includes(step) ? 'done' : ''}`}>
            <span className="step-num">2</span>
            <span className="step-label">OTP Verification</span>
          </div>
          <div className="abha-step-line" />
          <div className={`abha-step-item ${step === 'profile' ? 'active' : ['card', 'medical_history'].includes(step) ? 'done' : ''}`}>
            <span className="step-num">3</span>
            <span className="step-label">Details</span>
          </div>
          <div className="abha-step-line" />
          <div className={`abha-step-item ${step === 'card' ? 'active' : step === 'medical_history' ? 'done' : ''}`}>
            <span className="step-num">4</span>
            <span className="step-label">ABHA Card</span>
          </div>
          <div className="abha-step-line" />
          <div className={`abha-step-item ${step === 'medical_history' ? 'active' : ''}`}>
            <span className="step-num">5</span>
            <span className="step-label">Med History</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="clinical-alert clinical-alert-danger" style={{ margin: '0 24px 16px', padding: '10px 14px', fontSize: '0.85rem' }}>
            <AlertCircle size={16} />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: METHOD SELECTION */}
        {step === 'method' && (
          <form onSubmit={handleSendOtp} className="abha-step-body">
            <div className="abha-intro-box">
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Create Ayushman Bharat Health Account (ABHA)
              </h4>
              <p style={{ fontSize: '0.86rem', color: '#64748b', marginTop: 4 }}>
                Your ABHA connects you to digital healthcare across India under the Ayushman Bharat Digital Mission (ABDM). Choose your preferred e-KYC method:
              </p>
            </div>

            <div className="abha-method-tabs">
              <button
                type="button"
                className={`abha-method-btn ${authMethod === 'aadhaar' ? 'active' : ''}`}
                onClick={() => setAuthMethod('aadhaar')}
              >
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>🆔 Aadhaar Number</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>Fastest • Instant Demo e-KYC</div>
              </button>

              <button
                type="button"
                className={`abha-method-btn ${authMethod === 'mobile' ? 'active' : ''}`}
                onClick={() => setAuthMethod('mobile')}
              >
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>📱 Mobile Number</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>OTP via SMS</div>
              </button>

              <button
                type="button"
                className={`abha-method-btn ${authMethod === 'license' ? 'active' : ''}`}
                onClick={() => setAuthMethod('license')}
              >
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>🪪 Driving License</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>State Transport Dept</div>
              </button>
            </div>

            <div className="auth-input-group" style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="auth-input-label">
                  {authMethod === 'aadhaar' ? 'Enter 12-Digit Aadhaar Number:' : authMethod === 'mobile' ? 'Enter 10-Digit Mobile Number:' : 'Enter Driving License Number:'}
                </label>
                {authMethod === 'aadhaar' && (
                  <button
                    type="button"
                    onClick={handleDemoFillAadhaar}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#5568d7',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Sparkles size={12} />
                    <span>Auto-Fill Demo Aadhaar</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                className="auth-input-field"
                placeholder={authMethod === 'aadhaar' ? 'XXXX - XXXX - XXXX' : authMethod === 'mobile' ? '98XXXXXXXX' : 'DL-XXXXXXXXXXXX'}
                value={aadhaarNumber}
                onChange={(e) => handleAadhaarChange(e.target.value)}
                required
              />
            </div>

            {/* Legal consent check */}
            <div className="abha-consent-checkbox">
              <input
                type="checkbox"
                id="aadhaar-consent"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
              />
              <label htmlFor="aadhaar-consent">
                I hereby declare that I consent to the National Health Authority (NHA) using my Aadhaar number for authentication and generating an Ayushman Bharat Health Account (ABHA) in compliance with Section 4 of Aadhaar Act 2016 and Digital Personal Data Protection (DPDP) Act 2023.
              </label>
            </div>

            <div className="abha-modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ gap: 6 }}>
                <span>Continue to OTP Verification</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="abha-step-body">
            <div className="abha-intro-box">
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Verify Aadhaar e-KYC One-Time Password (OTP)
              </h4>
              <p style={{ fontSize: '0.86rem', color: '#64748b', marginTop: 4 }}>
                A 6-digit verification code has been dispatched to your Aadhaar-linked mobile ending with •••• 9821.
              </p>
            </div>

            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Enter 6-Digit OTP:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="auth-input-field"
                  style={{
                    width: 220,
                    textAlign: 'center',
                    fontSize: '1.6rem',
                    letterSpacing: '8px',
                    fontWeight: 800,
                    fontFamily: 'monospace'
                  }}
                  placeholder="••••••"
                  autoFocus
                  required
                />

                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setOtpCode('749102')}
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '5px 12px', minHeight: 'auto', background: '#eff6ff', color: '#1d4ed8' }}
                  >
                    <Sparkles size={13} />
                    <span>⚡ Fill Demo OTP (749102)</span>
                  </button>

                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Resend in {timer}s
                  </span>
                </div>
              </div>
            </div>

            <div className="abha-modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setStep('method')}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button type="submit" className="btn btn-primary" style={{ gap: 6 }}>
                <span>Validate & Proceed</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: DEMOGRAPHICS & ABHA ADDRESS */}
        {step === 'profile' && (
          <form onSubmit={handleGenerateCard} className="abha-step-body">
            <div className="abha-intro-box">
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Confirm Profile & Choose ABHA Address
              </h4>
              <p style={{ fontSize: '0.86rem', color: '#64748b', marginTop: 4 }}>
                Details fetched from Aadhaar e-KYC. Set your unique healthcare address handle (e.g. yourname@abdm).
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="auth-input-group">
                <label className="auth-input-label">Full Name:</label>
                <input
                  type="text"
                  className="auth-input-field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label">Mobile Number:</label>
                <input
                  type="tel"
                  className="auth-input-field"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label">Age & Gender:</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="number"
                    className="auth-input-field"
                    style={{ width: 90 }}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    min={1}
                    max={120}
                    required
                  />
                  <select
                    className="auth-input-field"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="female">Female (ಮಹಿಳೆ)</option>
                    <option value="male">Male (ಪುರುಷ)</option>
                    <option value="other">Other (ಇತರೆ)</option>
                  </select>
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label">State & District:</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    className="auth-input-field"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="District"
                    required
                  />
                  <input
                    type="text"
                    className="auth-input-field"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="State"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ABHA Address Handle */}
            <div className="auth-input-group" style={{ marginTop: 6 }}>
              <label className="auth-input-label">Choose Your ABHA Address (@abdm):</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  className="auth-input-field"
                  value={customAbhaHandle}
                  onChange={(e) => setCustomAbhaHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  placeholder="e.g. kavita.rao"
                  required
                />
                <span style={{ fontWeight: 800, color: '#5568d7', fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                  @abdm
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
                <CheckCircle2 size={13} />
                <span>ABHA address {customAbhaHandle || 'handle'}@abdm is available</span>
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-input-label">Create Vault Password / PIN:</label>
              <input
                type="password"
                className="auth-input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: password123)"
                required
              />
            </div>

            <div className="abha-modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setStep('otp')}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <button type="submit" className="btn btn-primary" style={{ gap: 6 }}>
                <span>Issue Official ABHA Card</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: OFFICIAL ABHA HEALTH CARD */}
        {step === 'card' && (
          <div className="abha-step-body">
            <div className="abha-intro-box" style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dcfce7', color: '#15803d', padding: '4px 14px', borderRadius: 999, fontWeight: 700, fontSize: '0.82rem', marginBottom: 8 }}>
                <CheckCircle2 size={14} />
                <span>Ayushman Bharat Health Account Created Successfully!</span>
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Your Official Digital ABHA Health Card
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Government of India • Ministry of Health & Family Welfare (MoHFW)
              </p>
            </div>

            {/* REALISTIC 3D-STYLE ABHA CARD */}
            <div className="abha-physical-card">
              {/* Card Tricolor Header */}
              <div className="abha-card-top-strip" />

              <div className="abha-card-header">
                <div className="abha-card-logo-group">
                  <div className="abha-card-emblem">🇮🇳</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.78rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      National Health Authority
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Government of India | ABDM
                    </div>
                  </div>
                </div>

                <div className="abha-card-badge-right">
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8' }}>ABHA</span>
                  <div style={{ fontSize: '0.62rem', color: '#475569' }}>DIGITAL ID</div>
                </div>
              </div>

              {/* Card Body */}
              <div className="abha-card-body">
                <div className="abha-card-avatar">
                  {gender === 'female' ? '👩' : '👨'}
                </div>

                <div className="abha-card-info">
                  <h3 className="abha-card-name">{fullName}</h3>

                  <div className="abha-card-num-box">
                    <span className="abha-card-num-label">ABHA Number:</span>
                    <strong className="abha-card-number">{generatedAbhaNumber}</strong>
                    <button
                      type="button"
                      onClick={handleCopyAbha}
                      className="abha-copy-btn"
                      title="Copy ABHA number"
                    >
                      {copiedAbha ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    </button>
                  </div>

                  <div className="abha-card-meta-row">
                    <div>
                      <span className="card-sub-label">ABHA Address:</span>
                      <strong className="card-sub-val">{customAbhaHandle}@abdm</strong>
                    </div>
                    <div>
                      <span className="card-sub-label">Gender / Age:</span>
                      <strong className="card-sub-val">{gender.toUpperCase()} / {age} Yrs</strong>
                    </div>
                  </div>

                  <div className="abha-card-meta-row" style={{ marginTop: 4 }}>
                    <div>
                      <span className="card-sub-label">State & District:</span>
                      <strong className="card-sub-val">{district}, {stateName}</strong>
                    </div>
                    <div>
                      <span className="card-sub-label">Mobile:</span>
                      <strong className="card-sub-val">+91 {mobileNumber.slice(0, 5)} •••••</strong>
                    </div>
                  </div>
                </div>

                <div className="abha-card-qr-box">
                  <div className="abha-qr-code">
                    <QrCode size={52} color="#0f172a" />
                  </div>
                  <span style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 700, marginTop: 4 }}>
                    SCAN & SHARE
                  </span>
                </div>
              </div>

              {/* Holographic Security Bottom Bar */}
              <div className="abha-card-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: '#475569' }}>
                  <Lock size={11} color="#16a34a" />
                  <span>Encrypted Safe Vault • DPDP Act 2023 Compliant</span>
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0f766e' }}>
                  ABDM VERIFIED ●
                </div>
              </div>
            </div>

            {/* Card Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '14px 0 20px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 14px', minHeight: 'auto', gap: 6 }}
                onClick={() => alert(`📥 ABHA Health Card for ${fullName} (${generatedAbhaNumber}) downloaded as PDF.`)}
              >
                <Download size={14} />
                <span>Download Card (PDF)</span>
              </button>

              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 14px', minHeight: 'auto', gap: 6 }}
                onClick={() => window.print()}
              >
                <Printer size={14} />
                <span>Print Card</span>
              </button>
            </div>

            {/* Next Step Callout */}
            <div className="clinical-alert clinical-alert-info" style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 18 }}>
              <Sparkles size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
              <div>
                <strong>Next Step: Add Your Medical History</strong>
                <p style={{ fontSize: '0.82rem', marginTop: 2, color: '#334155' }}>
                  Add your past illnesses, medications, allergies, and diagnostic reports to initialize your encrypted personal health record.
                </p>
              </div>
            </div>

            <div className="abha-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => handleSaveAndComplete(true)}
                disabled={isLoading}
              >
                Skip & Enter Portal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep('medical_history')}
                style={{ gap: 6 }}
              >
                <span>Add Medical History Now</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: ADD MEDICAL HISTORY */}
        {step === 'medical_history' && (
          <div className="abha-step-body">
            <div className="abha-intro-box">
              <h4 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0f172a' }}>
                Add Medical History & Health Records for {fullName}
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                Under DPDP Act 2023, your medical history stays encrypted in the CareBridge vault and is only shared with tele-doctors when you approve a purpose-bound consent request.
              </p>
            </div>

            {/* Section 1: Chronic Conditions */}
            <div className="medhist-section">
              <div className="medhist-title-row">
                <Heart size={16} color="#dc2626" />
                <span className="medhist-section-title">1. Chronic Conditions & Past Illnesses</span>
              </div>
              <div className="medhist-chip-grid">
                {COMMON_CONDITIONS.map(cond => (
                  <button
                    key={cond}
                    type="button"
                    className={`medhist-chip ${selectedConditions.includes(cond) ? 'selected' : ''}`}
                    onClick={() => toggleCondition(cond)}
                  >
                    {selectedConditions.includes(cond) && <Check size={12} />}
                    <span>{cond}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder="+ Add another condition (e.g. Migraine, Kidney Stone)"
                  value={customCondition}
                  onChange={(e) => setCustomCondition(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCondition(); } }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={addCustomCondition}
                  style={{ minHeight: 'auto', padding: '0 14px' }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Section 2: Allergies */}
            <div className="medhist-section">
              <div className="medhist-title-row">
                <AlertTriangle size={16} color="#d97706" />
                <span className="medhist-section-title">2. Known Drug & Environmental Allergies</span>
              </div>
              <div className="medhist-chip-grid">
                {COMMON_ALLERGIES.map(alg => (
                  <button
                    key={alg}
                    type="button"
                    className={`medhist-chip ${selectedAllergies.includes(alg) ? 'selected' : ''}`}
                    onClick={() => toggleAllergy(alg)}
                  >
                    {selectedAllergies.includes(alg) && <Check size={12} />}
                    <span>{alg}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder="+ Add custom drug/food allergy"
                  value={customAllergy}
                  onChange={(e) => setCustomAllergy(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAllergy(); } }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={addCustomAllergy}
                  style={{ minHeight: 'auto', padding: '0 14px' }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Section 3: Current Medications */}
            <div className="medhist-section">
              <div className="medhist-title-row">
                <Pill size={16} color="#5568d7" />
                <span className="medhist-section-title">3. Current Active Medications</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder="e.g. Metformin 500mg (Daily Morning) or Paracetamol 650mg PRN"
                  value={newMedInput}
                  onChange={(e) => setNewMedInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMedication(); } }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addMedication}
                  style={{ minHeight: 'auto', padding: '0 14px' }}
                >
                  Add Med
                </button>
              </div>

              {currentMeds.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {currentMeds.map((med, idx) => (
                    <span
                      key={idx}
                      className="audit-pill"
                      style={{ background: '#eff6ff', color: '#1e40af', padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Pill size={12} />
                      <span>{med}</span>
                      <button
                        type="button"
                        onClick={() => removeMedication(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 6 }}>
                  No ongoing medications listed yet.
                </div>
              )}
            </div>

            {/* Section 4: Past Surgeries & Blood Group */}
            <div className="medhist-section">
              <div className="medhist-title-row">
                <Activity size={16} color="#0d9488" />
                <span className="medhist-section-title">4. Past Surgeries & Blood Group</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Blood Group:</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                    <button
                      key={bg}
                      type="button"
                      className={`medhist-chip ${bloodGroup === bg ? 'selected' : ''}`}
                      style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                      onClick={() => setBloodGroup(bg)}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="medhist-chip-grid">
                {COMMON_SURGERIES.map(surg => (
                  <button
                    key={surg}
                    type="button"
                    className={`medhist-chip ${selectedSurgeries.includes(surg) ? 'selected' : ''}`}
                    onClick={() => toggleSurgery(surg)}
                  >
                    {selectedSurgeries.includes(surg) && <Check size={12} />}
                    <span>{surg}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 5: Initial Diagnostic Record / Lab Scan (Optional) */}
            <div className="medhist-section" style={{ border: '1px solid #bfdbfe', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="medhist-title-row" style={{ marginBottom: 0 }}>
                  <FileText size={16} color="#2563eb" />
                  <span className="medhist-section-title">5. Upload Initial Diagnostic Report / Lab Scan</span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', color: '#1d4ed8' }}>
                  <input
                    type="checkbox"
                    checked={includeRecord}
                    onChange={(e) => setIncludeRecord(e.target.checked)}
                  />
                  <span>Attach Past Report</span>
                </label>
              </div>

              {includeRecord && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <div className="auth-input-group" style={{ marginBottom: 0 }}>
                      <label className="auth-input-label">Report Title:</label>
                      <input
                        type="text"
                        className="auth-input-field"
                        value={recordTitle}
                        onChange={(e) => setRecordTitle(e.target.value)}
                        placeholder="e.g. Previous Ultrasound Pelvis"
                      />
                    </div>
                    <div className="auth-input-group" style={{ marginBottom: 0 }}>
                      <label className="auth-input-label">Record Type:</label>
                      <select
                        className="auth-input-field"
                        value={recordType}
                        onChange={(e) => setRecordType(e.target.value)}
                      >
                        <option value="ultrasound">Ultrasound / Scan</option>
                        <option value="blood_panel">Blood Panel / Lab</option>
                        <option value="ecg">ECG / Cardiology</option>
                        <option value="prescription">Prescription</option>
                        <option value="discharge_summary">Discharge Summary</option>
                      </select>
                    </div>
                  </div>

                  <div className="auth-input-group" style={{ marginBottom: 0 }}>
                    <label className="auth-input-label">Summary Findings / Doctor Notes:</label>
                    <textarea
                      className="auth-input-field"
                      style={{ height: 60, resize: 'none' }}
                      value={recordFindings}
                      onChange={(e) => setRecordFindings(e.target.value)}
                      placeholder="Summary findings from past hospital or lab"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="abha-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep('card')}
                disabled={isLoading}
              >
                <ArrowLeft size={16} />
                <span>Back to Card</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSaveAndComplete(false)}
                disabled={isLoading}
                style={{ gap: 6 }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Saving to Encrypted Vault...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Save Medical History & Enter Portal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
