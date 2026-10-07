import React, { useState } from 'react';
import type { AuthSession } from '../types';
import { Stethoscope, Phone, Lock, UserPlus, KeyRound, Sparkles, AlertCircle, Award, CheckCircle } from 'lucide-react';

interface DoctorAuthProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const DoctorAuth: React.FC<DoctorAuthProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'docId' | 'mobile'>('docId');

  // Login Form State
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regDocId, setRegDocId] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('password123');
  const [regSpecialty, setRegSpecialty] = useState('General Medicine');
  const [regQualification, setRegQualification] = useState('MBBS, MD');

  // Demo Credentials Auto-Fill
  const fillDemoDoctor = (method: 'docId' | 'mobile') => {
    setLoginMethod(method);
    if (method === 'docId') {
      setLoginId('NMC-KA-581920');
    } else {
      setLoginId('9876543210');
    }
    setLoginPassword('password123');
    setLoginError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError("Please enter your Doctor ID / NMC Number or Mobile Number and Password.");
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'doctor',
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
        role: 'doctor',
        user_id: data.user.user_id,
        name: data.user.display_name,
        identifier: data.user.registration_number,
        phone_number: data.user.phone_number,
        specialty: data.user.specialty
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
    if (!regFullName || !regDocId || !regMobile || !regPassword) {
      setLoginError("All registration fields are required.");
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/v1/auth/register/doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regFullName.trim(),
          registration_number: regDocId.trim(),
          mobile_number: regMobile.trim(),
          password: regPassword.trim(),
          specialty: regSpecialty,
          qualification: regQualification
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      const session: AuthSession = {
        token: data.token,
        role: 'doctor',
        user_id: data.user.user_id,
        name: data.user.display_name,
        identifier: data.user.registration_number,
        phone_number: data.user.phone_number,
        specialty: data.user.specialty
      };

      alert("✅ Practitioner registered & verified under NMC! Logged in as " + data.user.display_name);
      onLoginSuccess(session);
    } catch (err: any) {
      setLoginError(err.message || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '20px auto' }}>
      <div className="cb-card" style={{ border: '2px solid #cbd5e1', padding: 28 }}>
        {/* NMC Professional Doctor Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 52,
            height: 52,
            margin: '0 auto 10px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0b63e5 100%)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)'
          }}>
            <Stethoscope size={28} />
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span className="audit-pill" style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 700 }}>
              National Medical Commission (NMC) Portal
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--cb-text-main)', marginTop: 4 }}>
            Telemedicine Physician Gateway
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--cb-text-muted)', marginTop: 4 }}>
            Secure sign-in for registered clinicians conducting virtual teleconsultations.
          </p>
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
            <span>Physician Sign-In</span>
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'register' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none', minHeight: 40, fontSize: '0.88rem' }}
            onClick={() => { setActiveTab('register'); setLoginError(null); }}
          >
            <UserPlus size={16} />
            <span>Register Tele-Clinician</span>
          </button>
        </div>

        {loginError && (
          <div className="clinical-alert clinical-alert-danger" style={{ marginBottom: 16 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{loginError}</div>
          </div>
        )}

        {/* TAB 1: DOCTOR LOGIN */}
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
                  name="docLoginMethod"
                  checked={loginMethod === 'docId'}
                  onChange={() => { setLoginMethod('docId'); setLoginId('NMC-KA-581920'); }}
                />
                <span>Unique Doctor ID / NMC Reg</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="radio"
                  name="docLoginMethod"
                  checked={loginMethod === 'mobile'}
                  onChange={() => { setLoginMethod('mobile'); setLoginId('9876543210'); }}
                />
                <span>Registered Mobile Number</span>
              </label>
            </div>

            {/* Identifier Input */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                {loginMethod === 'docId' ? 'Unique Doctor ID / NMC Registration Number:' : 'Registered Mobile Number:'}
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: 11, color: 'var(--cb-text-muted)' }}>
                  {loginMethod === 'docId' ? <Award size={18} /> : <Phone size={18} />}
                </div>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder={loginMethod === 'docId' ? 'e.g. NMC-KA-581920' : '98765 43210'}
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
                Clinician Password:
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
              {isLoading ? "Authenticating Clinician..." : "🩺 Sign In to Consultation Console"}
            </button>

            {/* 1-Click Demo Pre-fills */}
            <div style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px dashed var(--cb-border)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--cb-text-muted)', display: 'block', marginBottom: 8 }}>
                ⚡ 1-Click Quick Fill Demo Credentials:
              </span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 'auto' }}
                  onClick={() => fillDemoDoctor('docId')}
                >
                  <Sparkles size={13} style={{ color: '#0b63e5' }} />
                  <span>Dr. Ananya Sharma (NMC ID)</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 'auto' }}
                  onClick={() => fillDemoDoctor('mobile')}
                >
                  <Sparkles size={13} style={{ color: '#0d9488' }} />
                  <span>Dr. Ananya Sharma (Mobile)</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTER NEW DOCTOR */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Practitioner Full Name:
              </label>
              <input
                type="text"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="Dr. Suresh Kumar"
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
                  Unique Doctor ID / NMC Reg:
                </label>
                <input
                  type="text"
                  value={regDocId}
                  onChange={(e) => setRegDocId(e.target.value)}
                  placeholder="NMC-KA-778899"
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
                  Mobile Number:
                </label>
                <input
                  type="tel"
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value)}
                  placeholder="9888776655"
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Medical Specialty:
                </label>
                <select
                  value={regSpecialty}
                  onChange={(e) => setRegSpecialty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--cb-border)',
                    fontSize: '0.88rem'
                  }}
                >
                  <option value="General Medicine">General Medicine</option>
                  <option value="Urology & Renal Care">Urology & Renal Care</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
                  <option value="Dermatology">Dermatology</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Medical Qualifications:
                </label>
                <input
                  type="text"
                  value={regQualification}
                  onChange={(e) => setRegQualification(e.target.value)}
                  placeholder="MBBS, MD / MS"
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

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Account Password:
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Set practitioner password"
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

            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--cb-border)',
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 16,
              fontSize: '0.78rem',
              color: 'var(--cb-text-muted)',
              display: 'flex',
              gap: 8,
              alignItems: 'center'
            }}>
              <CheckCircle size={16} color="var(--cb-success)" />
              <span>By registering, I declare that I am a registered medical practitioner under the National Medical Commission (NMC) Act 2019.</span>
            </div>

            <button
              type="submit"
              className="btn btn-success"
              style={{ width: '100%', minHeight: 46, fontSize: '0.95rem', fontWeight: 700 }}
              disabled={isLoading}
            >
              {isLoading ? "Registering Clinician..." : "➕ Register & Verify Practitioner"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
