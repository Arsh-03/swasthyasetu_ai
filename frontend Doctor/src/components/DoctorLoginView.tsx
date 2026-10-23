import React, { useState } from 'react';
import type { DoctorProfile } from '../services/api';
import { api } from '../services/api';

interface DoctorLoginViewProps {
  onLoginSuccess: (doctor: DoctorProfile) => void;
  selectedLanguage: 'en' | 'kn' | 'hi';
}

export const DoctorLoginView: React.FC<DoctorLoginViewProps> = ({
  onLoginSuccess,
  selectedLanguage,
}) => {
  const [identifier, setIdentifier] = useState('NMC-KA-581920');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.loginDoctor(identifier, password);
      if (res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid Doctor Credentials. For demo use NMC-KA-581920 / password123');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setIdentifier('NMC-KA-581920');
    setPassword('password123');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4 selection:bg-[#007AFF]/20 selection:text-[#007AFF]">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-apple-lg border border-black/5 overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Clinical Branding Panel (5 cols) */}
        <div className="md:col-span-5 bg-[#1C1C1E] p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#007AFF]/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#5856D6]/15 rounded-full blur-2xl pointer-events-none -ml-16 -mb-16"></div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-md ring-1 ring-white/20">
                <span className="material-symbols-outlined text-white text-2xl">health_and_safety</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-white">SwasthyaSetu</h1>
                <span className="text-[11px] uppercase tracking-wider text-[#007AFF] font-medium">Clinician Studio Pro</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 mt-4">
              <h2 className="text-xl lg:text-2xl font-semibold leading-snug text-white tracking-tight">
                Enterprise Telemedicine & Clinical Records Engine
              </h2>
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                Integrated practitioner workspace featuring ambient AI SOAP note generation, real-time CDSS drug contraindications, and DPDP purpose-bound patient consent tokens.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/10 flex flex-col gap-2.5 text-xs text-[#8E8E93]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#34C759] text-base">verified</span>
              <span className="text-[#D1D1D6] font-medium">NMC Telemedicine Practice Guidelines 2020</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#007AFF] text-base">lock</span>
              <span className="text-[#D1D1D6] font-medium">DPDP Act 2023 Cryptographic Consent Vault</span>
            </div>
          </div>
        </div>

        {/* Right Authentication Form (7 cols) */}
        <div className="md:col-span-7 p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#007AFF] uppercase tracking-wider">Practitioner Authentication</span>
              <span className="text-[11px] text-[#636366] bg-[#F2F2F7] px-2.5 py-0.5 rounded-full font-medium">
                {selectedLanguage === 'kn' ? 'ವೈದ್ಯರ ಪ್ರವೇಶ' : selectedLanguage === 'hi' ? 'चिकित्सक लॉगिन' : 'ABDM Clinical Hub'}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-[#1C1C1E] tracking-tight mt-1">Welcome, Doctor</h3>
            <p className="text-xs text-[#8E8E93] mt-1">
              Enter your National Medical Commission registration ID and security credentials.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#1C1C1E] uppercase tracking-wider">
                NMC Registration Number
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-[#8E8E93] text-[18px]">badge</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. NMC-KA-581920"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA]/70 focus:bg-white border border-black/5 text-[13px] font-medium text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#1C1C1E] uppercase tracking-wider">Password</label>
                <span className="text-[11px] text-[#007AFF] font-medium cursor-pointer hover:underline">
                  Forgot Password?
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-[#8E8E93] text-[18px]">lock</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA]/70 focus:bg-white border border-black/5 text-[13px] text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] transition-all"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-apple-sm transition-all"
              >
                {loading ? (
                  <span>Authenticating Practitioner...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    <span>Sign In to Clinical Studio</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="w-full py-2.5 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] text-xs font-semibold flex items-center justify-center gap-1.5 border border-black/5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm text-[#FF9500]">bolt</span>
                <span>Demo 1-Click: Dr. Ananya Sharma (NMC-KA-581920)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
