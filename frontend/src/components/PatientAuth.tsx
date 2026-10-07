import React, { useState } from 'react';
import type { Language, AuthSession } from '../types';
import { ShieldCheck, User, Phone, Lock, UserPlus, KeyRound, Volume2, Sparkles, AlertCircle } from 'lucide-react';

interface PatientAuthProps {
  language: Language;
  onLoginSuccess: (session: AuthSession) => void;
  onPlayAudio: (text: string) => void;
  isPlayingAudio: boolean;
}

export const PatientAuth: React.FC<PatientAuthProps> = ({
  language,
  onLoginSuccess,
  onPlayAudio,
  isPlayingAudio
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'abha' | 'mobile'>('abha');

  // Login Form State
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regAbha, setRegAbha] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('password123');
  const [regAge, setRegAge] = useState<number>(54);
  const [regGender, setRegGender] = useState('male');
  const [regDistrict, setRegDistrict] = useState('Hassan, Karnataka');
  const [regLang, setRegLang] = useState<Language>(language);

  // Demo Credentials Auto-Fill
  const fillDemoPatient = (method: 'abha' | 'mobile') => {
    setLoginMethod(method);
    if (method === 'abha') {
      setLoginId('91-4820-1928-1120@abdm');
    } else {
      setLoginId('9845012345');
    }
    setLoginPassword('password123');
    setLoginError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError("Please enter your ABHA ID or Mobile Number and Password.");
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'patient',
          identifier: loginId.trim(),
          password: loginPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      const session: AuthSession = {
        token: data.token,
        role: 'patient',
        user_id: data.user.user_id,
        name: data.user.full_name,
        identifier: data.user.abha_address,
        phone_number: data.user.phone_number,
        preferred_language: data.user.preferred_language || language
      };

      onLoginSuccess(session);
    } catch (err: any) {
      setLoginError(err.message || "Failed to log in. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName || !regAbha || !regMobile || !regPassword) {
      setLoginError("All registration fields are required.");
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const abhaFormatted = regAbha.includes('@') ? regAbha.trim() : `${regAbha.trim()}@abdm`;

      const res = await fetch('/api/v1/auth/register/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regFullName.trim(),
          abha_address: abhaFormatted,
          mobile_number: regMobile.trim(),
          password: regPassword.trim(),
          preferred_language: regLang,
          age: Number(regAge),
          gender: regGender,
          district: regDistrict.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      const session: AuthSession = {
        token: data.token,
        role: 'patient',
        user_id: data.user.user_id,
        name: data.user.full_name,
        identifier: data.user.abha_address,
        phone_number: data.user.phone_number,
        preferred_language: data.user.preferred_language
      };

      alert("✅ ABHA Account created successfully! Logged in as " + data.user.full_name);
      onLoginSuccess(session);
    } catch (err: any) {
      setLoginError(err.message || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '20px auto' }}>
      <div className="cb-card" style={{ border: '2px solid var(--cb-primary-border)', padding: 28 }}>
        {/* ABDM Trust Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 52,
            height: 52,
            margin: '0 auto 10px',
            background: 'linear-gradient(135deg, #0b63e5 0%, #0d9488 100%)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(11, 99, 229, 0.3)'
          }}>
            <ShieldCheck size={28} />
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span className="audit-pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
              ABDM National Health Authority
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--cb-text-main)', marginTop: 4 }}>
            ರೋಗಿಯ ಪ್ರವೇಶ ದ್ವಾರ (Patient ABHA Portal)
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--cb-text-muted)', marginTop: 4 }}>
            Sign in with your verified Ayushman Bharat Health Account (ABHA) or Mobile Number.
          </p>

          <button
            className={`btn-audio ${isPlayingAudio ? 'playing' : ''}`}
            style={{ marginTop: 10 }}
            onClick={() => onPlayAudio("ಸ್ವಾಗತ. ನಿಮ್ಮ ಎ ಬಿ ಎಚ್ ಎ ಗುರುತಿನ ಸಂಖ್ಯೆ ಅಥವಾ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ ಲಾಗಿನ್ ಮಾಡಿ.")}
            type="button"
          >
            <Volume2 size={16} />
            <span>ಧ್ವನಿ ಸೂಚನೆ ಕೇಳಿ (Audio Guide)</span>
          </button>
        </div>

        {/* Tab Toggle: Login vs Register */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 10,
          marginBottom: 20,
          gap: 6
        }}>
          <button
            type="button"
            className={`btn ${activeTab === 'login' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none', minHeight: 40, fontSize: '0.88rem' }}
            onClick={() => { setActiveTab('login'); setLoginError(null); }}
          >
            <KeyRound size={16} />
            <span>ಪ್ರವೇಶಿಸಿ (Sign In)</span>
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'register' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none', minHeight: 40, fontSize: '0.88rem' }}
            onClick={() => { setActiveTab('register'); setLoginError(null); }}
          >
            <UserPlus size={16} />
            <span>ಖಾತೆ ರಚಿಸಿ (Create ABHA)</span>
          </button>
        </div>

        {loginError && (
          <div className="clinical-alert clinical-alert-danger" style={{ marginBottom: 16 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{loginError}</div>
          </div>
        )}

        {/* TAB 1: LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            {/* Login Mode Toggle */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--cb-border)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              gap: 20,
              fontSize: '0.88rem'
            }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="radio"
                  name="patLoginMethod"
                  checked={loginMethod === 'abha'}
                  onChange={() => { setLoginMethod('abha'); setLoginId('91-4820-1928-1120@abdm'); }}
                />
                <span>ABHA ID / ವಿಳಾಸ</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="radio"
                  name="patLoginMethod"
                  checked={loginMethod === 'mobile'}
                  onChange={() => { setLoginMethod('mobile'); setLoginId('9845012345'); }}
                />
                <span>ಮೊಬೈಲ್ ಸಂಖ್ಯೆ (Mobile No.)</span>
              </label>
            </div>

            {/* Identifier Input */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                {loginMethod === 'abha' ? 'ABHA Address / 14-Digit ID (ಎ ಬಿ ಎಚ್ ಎ ವಿಳಾಸ):' : 'Registered Mobile Number (ಮೊಬೈಲ್ ಸಂಖ್ಯೆ):'}
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: 11, color: 'var(--cb-text-muted)' }}>
                  {loginMethod === 'abha' ? <User size={18} /> : <Phone size={18} />}
                </div>
                <input
                  type={loginMethod === 'abha' ? 'text' : 'tel'}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder={loginMethod === 'abha' ? '91-4820-1928-1120@abdm' : '98450 12345'}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 8,
                    border: '1.5px solid var(--cb-border)',
                    fontSize: '0.92rem'
                  }}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Password / ಪಾಸ್‌ವರ್ಡ್:
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: 11, color: 'var(--cb-text-muted)' }}>
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter password (default: password123)"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 8,
                    border: '1.5px solid var(--cb-border)',
                    fontSize: '0.92rem'
                  }}
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', minHeight: 46, fontSize: '0.95rem', fontWeight: 700 }}
              disabled={isLoading}
            >
              {isLoading ? "ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ (Verifying...)" : "🔑 ABHA ಲಾಗಿನ್ (Sign In)"}
            </button>

            {/* 1-Click Demo Pre-fills */}
            <div style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px dashed var(--cb-border)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--cb-text-muted)', display: 'block', marginBottom: 8 }}>
                ⚡ ಡೆಮೊ ಪರೀಕ್ಷೆಗಾಗಿ 1-ಕ್ಲಿಕ್ ಸ್ವಯಂ-ಭರ್ತಿ (Quick Fill Demo):
              </span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 'auto' }}
                  onClick={() => fillDemoPatient('abha')}
                >
                  <Sparkles size={13} style={{ color: '#0b63e5' }} />
                  <span>ರಮೇಶ್ ಗೌಡ (ABHA ID)</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 'auto' }}
                  onClick={() => fillDemoPatient('mobile')}
                >
                  <Sparkles size={13} style={{ color: '#0d9488' }} />
                  <span>ರಮೇಶ್ ಗೌಡ (ಮೊಬೈಲ್)</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTER NEW PATIENT */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                ಪೂರ್ಣ ಹೆಸರು (Full Name):
              </label>
              <input
                type="text"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="ಉದಾ. ಬಸವರಾಜ್ ಪಾಟೀಲ್ / Basavaraj Patil"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--cb-border)',
                  fontSize: '0.88rem'
                }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  ಬಯಸಿದ ABHA ವಿಳಾಸ:
                </label>
                <input
                  type="text"
                  value={regAbha}
                  onChange={(e) => setRegAbha(e.target.value)}
                  placeholder="name@abdm"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--cb-border)',
                    fontSize: '0.88rem'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  ಮೊಬೈಲ್ ಸಂಖ್ಯೆ (Mobile):
                </label>
                <input
                  type="tel"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  placeholder="9900112233"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--cb-border)',
                    fontSize: '0.88rem'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  ವಯಸ್ಸು (Age):
                </label>
                <input
                  type="number"
                  value={regAge}
                  onChange={(e) => setRegAge(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--cb-border)',
                    fontSize: '0.88rem'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  ಲಿಂಗ (Gender):
                </label>
                <select
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--cb-border)',
                    fontSize: '0.88rem'
                  }}
                >
                  <option value="male">ಪುರುಷ (Male)</option>
                  <option value="female">ಮಹಿಳೆ (Female)</option>
                  <option value="other">ಇತರ (Other)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  ಭಾಷೆ (Language):
                </label>
                <select
                  value={regLang}
                  onChange={(e) => setRegLang(e.target.value as Language)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--cb-border)',
                    fontSize: '0.88rem'
                  }}
                >
                  <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                ಜಿಲ್ಲೆ / ವಿಳಾಸ (District):
              </label>
              <input
                type="text"
                value={regDistrict}
                onChange={(e) => setRegDistrict(e.target.value)}
                placeholder="ಹಾಸನ, ಕರ್ನಾಟಕ / Hassan, Karnataka"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--cb-border)',
                  fontSize: '0.88rem'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದಿಸಿ (Set Password):
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Set password"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--cb-border)',
                  fontSize: '0.88rem'
                }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-success"
              style={{ width: '100%', minHeight: 46, fontSize: '0.95rem', fontWeight: 700 }}
              disabled={isLoading}
            >
              {isLoading ? "ಖಾತೆ ರಚಿಸಲಾಗುತ್ತಿದೆ..." : "➕ ABHA ಖಾತೆ ರಚಿಸಿ (Register)"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
