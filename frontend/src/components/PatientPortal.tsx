import React, { useState, useEffect } from 'react';
import type { Language, NetworkTier, HealthRecord, ClinicalNote, AuthSession } from '../types';
import { translations } from '../translations';
import { dynamicTranslator } from '../services/translator';
import { authFetch } from '../services/apiClient';
import { AddMedicalRecordModal } from './AddMedicalRecordModal';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, Shield, Lock, Unlock,
  FileCheck, Send, UserCheck, ShieldAlert, Clock, Pill, Sparkles,
  FilePlus, Heart, Plus, Activity, CheckCircle, PhoneCall
} from 'lucide-react';

interface PatientPortalProps {
  language: Language;
  networkTier: NetworkTier;
  onNetworkTierChange?: (tier: NetworkTier) => void;
  records: HealthRecord[];
  activeConsentToken: string | null;
  onSimulateDoctorRequest: () => void;
  onRevokeConsent: () => void;
  isRepresentative: boolean;
  setIsRepresentative: (val: boolean) => void;
  onPlayAudio: (text: string) => void;
  isPlayingAudio: boolean;
  signedNote: ClinicalNote | null;
  session?: AuthSession | null;
  onRecordAdded?: (newRecord: HealthRecord) => void;
}

type PatientTab = 'consultation' | 'records' | 'prescriptions' | 'profile';

export const PatientPortal: React.FC<PatientPortalProps> = ({
  language,
  networkTier,
  onNetworkTierChange,
  records,
  activeConsentToken,
  onSimulateDoctorRequest,
  onRevokeConsent,
  isRepresentative,
  setIsRepresentative,
  onPlayAudio,
  isPlayingAudio,
  signedNote,
  session,
  onRecordAdded
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<PatientTab>('consultation');

  // Video Consultation Session States
  const [isCallActive, setIsCallActive] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callNotice, setCallNotice] = useState<string | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [asyncChatInput, setAsyncChatInput] = useState('');
  const [asyncMessages, setAsyncMessages] = useState<string[]>([
    "Initial symptom note: Flank pain radiating to right lower abdomen for 3 days."
  ]);
  const [followupResponse, setFollowupResponse] = useState<string | null>(null);

  // Dynamic Profile & Medical History State
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);

  // Fetch verified profile from backend
  const fetchProfile = async () => {
    try {
      const res = await authFetch('/api/v1/auth/me');
      if (res.ok) {
        const data = await res.json();
        setPatientProfile(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchProfile();
  }, [session]);

  // Real-time WebSocket listener for medical history updates from Doctor
  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/telehealth`);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'PATIENT_HISTORY_UPDATED') {
            fetchProfile();
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (socket) socket.close();
    };
  }, []);

  // Derived patient identifiers
  const displayName = patientProfile?.full_name || session?.name || "Ramesh Gowda (ರಮೇಶ್ ಗೌಡ)";
  const abhaAddress = patientProfile?.abha_address || session?.identifier || "91-4820-1928-1120@abdm";
  const demoAge = patientProfile?.demographics?.age || 54;
  const demoGender = patientProfile?.demographics?.gender || "male";
  const demoDistrict = patientProfile?.demographics?.district || "Hassan, Karnataka";
  const demoAbhaNumber = patientProfile?.demographics?.abha_number || "91-4820-1928-1120";
  const medHist = patientProfile?.demographics?.medical_history || {
    chronic_conditions: ["Kidney Stone (Suspected Distal VUJ Calculus)"],
    current_medications: ["Gelusil Antacid 10ml TDS", "Paracetamol 500mg PRN"],
    active_medications: ["Gelusil Antacid 10ml TDS", "Paracetamol 500mg PRN"],
    allergies: ["Penicillin (Mild urticaria rash)"],
    surgeries: ["None reported"],
    blood_group: "O+"
  };

  // Dynamic Translation States (fetched from backend AI Translation Engine)
  const [dynAssessment, setDynAssessment] = useState<string>('');
  const [dynDiet, setDynDiet] = useState<string>('');
  const [dynRedFlags, setDynRedFlags] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDynamicTranslations = async () => {
      setIsTranslating(true);
      const rawAssessment = signedNote?.assessment || "Acute uncomplicated right ureteric colic secondary to 4.1mm distal stone";
      const rawDiet = signedNote?.plan?.dietary_advice || "Drink at least 2.5 to 3 Litres of clean water daily. Avoid excessive tea, spinach, and high-oxalate foods until stone passes.";
      const rawRedFlags = signedNote?.plan?.red_flags || "Visit hospital casualty immediately if you get high-grade fever with chills, or if you cannot pass urine.";

      const [transAssn, transDiet, transRf] = await Promise.all([
        dynamicTranslator.translateText(rawAssessment, language),
        dynamicTranslator.translateText(rawDiet, language),
        dynamicTranslator.translateText(rawRedFlags, language)
      ]);

      if (isMounted) {
        setDynAssessment(transAssn);
        setDynDiet(transDiet);
        setDynRedFlags(transRf);
        setIsTranslating(false);
      }
    };

    fetchDynamicTranslations();
    return () => { isMounted = false; };
  }, [language, signedNote]);

  const handleSendAsync = () => {
    if (!asyncChatInput.trim()) return;
    setAsyncMessages(prev => [...prev, asyncChatInput.trim()]);
    setAsyncChatInput('');
  };

  return (
    <div className="portal-container-theme">
      {/* Top Hero Card matching Login Aesthetic */}
      <div className="portal-hero-card">
        <div className="portal-hero-left">
          <div className="portal-hero-avatar">
            {demoGender === 'female' ? '👩' : '🧑‍🌾'}
          </div>
          <div>
            <div className="portal-hero-badge-row">
              <span className="portal-role-tag">ABHA Patient Portal</span>
              <span className="portal-abha-chip">{abhaAddress}</span>
              {isRepresentative && (
                <span className="portal-rep-badge">Family Rep Active (Sunita Devi)</span>
              )}
            </div>
            <h2 className="portal-hero-title">{displayName}</h2>
            <p className="portal-hero-subtitle">
              Age {demoAge} · {demoDistrict} · Primary Health Center Encounter #ENC-9481
            </p>
          </div>
        </div>

        <div className="portal-hero-actions">
          <button
            type="button"
            className={`btn-audio-pill ${isPlayingAudio ? 'playing' : ''}`}
            onClick={() => onPlayAudio(t.welcomeAudioText)}
            title="Listen to identity instructions in selected language"
          >
            <Volume2 size={16} />
            <span>{t.listenAudioBtn}</span>
          </button>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="portal-nav-tabs">
        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'consultation' ? 'active' : ''}`}
          onClick={() => setActiveTab('consultation')}
        >
          <Video size={16} />
          <span>{t.tabConsultation}</span>
          {isCallActive ? (
            <span className="tab-pill-badge" style={{ background: '#ef4444', color: '#ffffff' }}>Active Call</span>
          ) : isIncomingCall ? (
            <span className="tab-pill-badge" style={{ background: '#10b981', color: '#ffffff' }}>Ringing...</span>
          ) : (
            <span className="tab-pill-dot green"></span>
          )}
        </button>

        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <Shield size={16} />
          <span>{t.tabRecords}</span>
          {activeConsentToken && <span className="tab-pill-badge">Active Token</span>}
        </button>

        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          <FileCheck size={16} />
          <span>{t.tabPrescriptions}</span>
          {signedNote && <span className="tab-pill-badge blue">Signed</span>}
        </button>

        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <UserCheck size={16} />
          <span>{t.tabProfile}</span>
        </button>
      </div>

      {/* TAB 1: LIVE CONSULTATION ROOM */}
      {activeTab === 'consultation' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            {!isCallActive ? (
              /* ========================================================================= */
              /* STATE A: TELE-CONSULTATION WAITING ROOM / LOBBY (CALL NOT OPEN YET)     */
              /* ========================================================================= */
              <>
                <div className="cb-card-header">
                  <div className="cb-card-title">
                    <Video size={20} color="#5568d7" />
                    <span>Tele-Consultation Room</span>
                  </div>
                  <span className="audit-pill" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                    <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
                    ABDM Telemedicine Practice Guidelines (TPG 2020) Compliant
                  </span>
                </div>

                {/* Dismissible Post-Call Notice */}
                {callNotice && (
                  <div style={{
                    margin: '16px 20px 0 20px',
                    padding: '12px 16px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#15803d',
                    fontSize: '0.88rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={16} />
                      <span>{callNotice}</span>
                    </div>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                      onClick={() => setCallNotice(null)}
                    >
                      ✕ Dismiss
                    </button>
                  </div>
                )}

                {/* INCOMING CALL RINGING CARD */}
                {isIncomingCall && (
                  <div className="incoming-call-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div className="ringing-phone-icon">
                        📞
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.72rem', background: '#047857', padding: '2px 8px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            Incoming Video Call
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>Ringing...</span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '1.15rem', marginTop: 4 }}>
                          Dr. Ananya Sharma (MD)
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                          Primary Health Center Encounter #ENC-9481 · General Medicine
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          borderColor: '#f87171',
                          color: '#fca5a5',
                          padding: '10px 18px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          borderRadius: 10
                        }}
                        onClick={() => setIsIncomingCall(false)}
                      >
                        ✕ Decline
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          padding: '10px 22px',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          borderRadius: 10,
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onClick={() => {
                          setIsCallActive(true);
                          setIsIncomingCall(false);
                          setCallNotice(null);
                        }}
                      >
                        <Video size={18} />
                        <span>Accept Video Call</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* LOBBY CONTENT / READY ROOM */}
                <div style={{ padding: '24px 24px 32px 24px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 20,
                    marginBottom: 24
                  }}>
                    {/* Doctor Card */}
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 14,
                      padding: 20
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                        <div style={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.8rem',
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                        }}>
                          👩‍⚕️
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                              Dr. Ananya Sharma (MD)
                            </span>
                            <CheckCircle size={15} color="#16a34a" />
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                            NMC Medical Registration: #581920
                          </div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                            Online & Ready for Consultation
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.83rem', color: '#475569', lineHeight: 1.6, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                        <div><strong>Specialty:</strong> General Medicine & Telehealth</div>
                        <div><strong>Encounter:</strong> Primary Health Center #ENC-9481</div>
                        <div><strong>Facility:</strong> Hassan District Tele-Care Hub</div>
                      </div>
                    </div>

                    {/* Pre-Call Checklist Card */}
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 14,
                      padding: 20
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>
                        Telehealth Session Readiness
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.83rem', color: '#334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                          <span>Camera & Microphone devices ready</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                          <span>256-bit AES End-to-End Encrypted WebRTC channel</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                          <span>ABDM Digital Consent & Session Token verified</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>
                          <span>Adaptive stream ready (HD video, audio, or store & forward)</span>
                        </div>
                      </div>

                      <div style={{
                        marginTop: 14,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1e40af',
                        fontSize: '0.78rem'
                      }}>
                        💡 The video call only opens when you start or accept a call. Network quality can be tuned directly in the call screen.
                      </div>
                    </div>
                  </div>

                  {/* Lobby Action Controls */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                    paddingTop: 12,
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                        padding: '13px 26px',
                        fontSize: '0.96rem',
                        fontWeight: 700,
                        borderRadius: 12,
                        boxShadow: '0 6px 20px rgba(79, 70, 229, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                      onClick={() => {
                        setIsCallActive(true);
                        setCallNotice(null);
                      }}
                    >
                      <Video size={19} />
                      <span>Start Video Consultation</span>
                    </button>

                    {!isIncomingCall && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          borderColor: '#cbd5e1',
                          padding: '13px 20px',
                          fontSize: '0.88rem',
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          color: '#475569'
                        }}
                        onClick={() => setIsIncomingCall(true)}
                        title="Simulate doctor calling to test incoming call flow"
                      >
                        <PhoneCall size={16} />
                        <span>Simulate Doctor Calling</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* ========================================================================= */
              /* STATE B: ACTIVE VIDEO CALL INTERFACE (OPEN ONLY WHEN CALLING / ACCEPTED)  */
              /* ========================================================================= */
              <>
                <div className="cb-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="cb-card-title">
                      <Video size={20} color="#5568d7" />
                      <span>{t.liveConsultationWith}</span>
                    </div>
                    {/* Live Duration Indicator */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: '0.78rem',
                      fontWeight: 700
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                      <span>LIVE {formatDuration(callDuration)}</span>
                    </div>
                  </div>

                  {/* NETWORK SPEED & BANDWIDTH SELECTOR ON THE CALL INTERFACE */}
                  <div className="call-speed-controller" title="Network Connection Speed & Quality (Telehealth Stream Engine)">
                    <Activity size={15} color={networkTier === 'good' ? '#16a34a' : networkTier === 'weak' ? '#d97706' : '#dc2626'} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                      Speed:
                    </span>
                    <select
                      className="call-speed-select"
                      value={networkTier}
                      onChange={(e) => onNetworkTierChange?.(e.target.value as NetworkTier)}
                      style={{
                        color: networkTier === 'good' ? '#15803d' : networkTier === 'weak' ? '#b45309' : '#b91c1c'
                      }}
                    >
                      <option value="good">🟢 HD Video (450 kbps)</option>
                      <option value="weak">🟡 Audio Only (50 kbps)</option>
                      <option value="bad">🔴 Store & Forward (5 kbps)</option>
                    </select>
                  </div>
                </div>

                <div className="telehealth-viewport">
                  {/* TIER 1: HD Video */}
                  {networkTier === 'good' && (
                    <div className="video-stream-box">
                      <div style={{
                        width: 96,
                        height: 96,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #5568d7 0%, #0d9488 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.6rem',
                        boxShadow: '0 8px 24px rgba(85, 104, 215, 0.35)',
                        marginBottom: 12
                      }}>
                        👩‍⚕️
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>Dr. Ananya Sharma (MD)</div>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 3 }}>
                        NMC Medical Registration: #581920 (Verified General Physician)
                      </div>
                      <div style={{
                        marginTop: 10,
                        background: 'rgba(22, 163, 74, 0.2)',
                        color: '#4ade80',
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        ● 720p HD Full Duplex Video Stream Active (450 kbps)
                      </div>
                    </div>
                  )}

                  {/* TIER 2: Audio Priority */}
                  {networkTier === 'weak' && (
                    <div className="video-stream-box" style={{ background: '#090d16' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>🎙️</div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fbbf24' }}>
                        {t.audioOnlyTitle}
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8', maxWidth: 380, marginTop: 4 }}>
                        {t.audioOnlySub}
                      </p>
                      <div className="audio-visualizer-bars" style={{ marginTop: 14 }}>
                        <div className="audio-bar" />
                        <div className="audio-bar" />
                        <div className="audio-bar" />
                        <div className="audio-bar" />
                        <div className="audio-bar" />
                        <div className="audio-bar" />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: 10 }}>
                        50 kbps Voice Adaptive Bandwidth Mode
                      </div>
                    </div>
                  )}

                  {/* TIER 3: Store & Forward Async */}
                  {networkTier === 'bad' && (
                    <div className="video-stream-box" style={{ background: '#111827', padding: 20 }}>
                      <div style={{ color: '#f87171', fontWeight: 800, fontSize: '1rem' }}>
                        ⚠️ {t.storeAndForwardTitle}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4, marginBottom: 12 }}>
                        {t.storeAndForwardSub}
                      </p>

                      <div style={{
                        width: '100%',
                        background: '#1f2937',
                        borderRadius: 10,
                        padding: 12,
                        maxHeight: 120,
                        overflowY: 'auto',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        marginBottom: 12
                      }}>
                        {asyncMessages.map((msg, idx) => (
                          <div key={idx} style={{ marginBottom: 6, color: '#e5e7eb' }}>
                            <strong>You:</strong> {msg}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <input
                          type="text"
                          value={asyncChatInput}
                          onChange={(e) => setAsyncChatInput(e.target.value)}
                          placeholder={t.msgPlaceholder}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid #4b5563',
                            background: '#111827',
                            color: '#ffffff',
                            fontSize: '0.85rem'
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendAsync()}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', minHeight: 'auto', fontSize: '0.85rem' }}
                          onClick={handleSendAsync}
                        >
                          <Send size={15} />
                          <span>{t.sendMsgBtn}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Picture-in-Picture */}
                  <div className="self-pip-box">
                    <span style={{ fontSize: '1.3rem' }}>🧑‍🌾</span>
                    <span style={{ marginTop: 2, fontWeight: 700 }}>{t.youPip}</span>
                    <span style={{ color: isCamOff ? '#f87171' : '#4ade80', fontSize: '0.7rem' }}>
                      {isCamOff ? 'Camera Off' : 'Live Cam'}
                    </span>
                  </div>

                  {/* In-Call Controls */}
                  <div className="call-control-dock">
                    <button
                      type="button"
                      className={`call-action-btn ${isMicMuted ? 'muted' : ''}`}
                      onClick={() => setIsMicMuted(!isMicMuted)}
                      title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                    >
                      {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                      type="button"
                      className={`call-action-btn ${isCamOff ? 'muted' : ''}`}
                      onClick={() => setIsCamOff(!isCamOff)}
                      title={isCamOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                      {isCamOff ? <VideoOff size={18} /> : <Video size={18} />}
                    </button>
                    <button
                      type="button"
                      className="call-action-btn end"
                      onClick={() => {
                        setIsCallActive(false);
                        setCallNotice("Consultation concluded with Dr. Ananya Sharma. Telehealth discharge summary & prescriptions are ready in your Prescriptions tab.");
                      }}
                      title="End Consultation"
                    >
                      <PhoneOff size={18} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ABHA RECORDS & CONSENT VAULT */}
      {activeTab === 'records' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            <div className="cb-card-header">
              <div className="cb-card-title">
                <Shield size={20} color="#5568d7" />
                <span>{t.recordsTitle}</span>
              </div>
              <span className="audit-pill" style={{ background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                DPDP Act 2023 Cryptographic Shield
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {t.recordsSub}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.82rem', minHeight: 'auto', gap: 6 }}
                onClick={() => setIsAddRecordModalOpen(true)}
              >
                <FilePlus size={15} />
                <span>+ Add Medical Record / History</span>
              </button>
            </div>

            {/* List of records */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {records.map(rec => {
                const isUsg = rec.record_id === 'rec_usg_pelvis_2026';
                const isGranted = (isUsg && Boolean(activeConsentToken)) || rec.consent_status === 'approved';

                return (
                  <div
                    key={rec.record_id}
                    className="portal-record-item"
                    style={{
                      border: isGranted ? '2px solid #16a34a' : '1px solid #e2e8f0',
                      background: isGranted ? '#f0fdf4' : '#ffffff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a' }}>
                          {rec.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>
                          Date: {rec.date_str} · Size: {(rec.file_size_bytes / 1000000).toFixed(1)} MB · ABDM Safe Vault
                        </div>
                      </div>

                      <span
                        className="badge-status"
                        style={{
                          background: isGranted ? '#dcfce7' : '#fee2e2',
                          color: isGranted ? '#166534' : '#991b1b',
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}
                      >
                        {isGranted ? (
                          <>
                            <Unlock size={13} />
                            <span>{t.approvedBadge}</span>
                          </>
                        ) : (
                          <>
                            <Lock size={13} />
                            <span>{t.protectedBadge}</span>
                          </>
                        )}
                      </span>
                    </div>

                    {rec.summary_findings && (
                      <div style={{
                        marginTop: 10,
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                        lineHeight: 1.45
                      }}>
                        <strong style={{ color: '#0f172a' }}>Clinical Summary: </strong>
                        {rec.summary_findings}
                      </div>
                    )}

                    {/* 1-Click Revocation Pill */}
                    {isGranted && (
                      <div style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: '1px dashed #bbf7d0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10
                      }}>
                        <div style={{ fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} />
                          <span>Expires in ~59m · Single-Use Token in Vault</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '6px 14px', fontSize: '0.82rem', minHeight: 'auto' }}
                          onClick={onRevokeConsent}
                        >
                          <ShieldAlert size={15} />
                          <span>{t.revokeAccessBtn}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Test Simulation Button */}
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '0.9rem', background: '#f8fafc' }}
                onClick={onSimulateDoctorRequest}
              >
                {t.simulateRequestBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRESCRIPTIONS & CARE PLAN */}
      {activeTab === 'prescriptions' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            <div className="cb-card-header">
              <div className="cb-card-title">
                <FileCheck size={20} color="#16a34a" />
                <span>{t.dischargeTitle}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="audit-pill" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Sparkles size={12} />
                  <span>{isTranslating ? "Translating with Bhashini AI..." : "Bhashini AI Dynamic Translation Active"}</span>
                </span>
                <button
                  type="button"
                  className={`btn-audio-pill ${isPlayingAudio ? 'playing' : ''}`}
                  onClick={() => onPlayAudio(`${dynAssessment || signedNote?.assessment}. ${dynDiet || signedNote?.plan?.dietary_advice}. ${dynRedFlags || signedNote?.plan?.red_flags}`)}
                  title="Listen to dynamic vernacular voice guidance"
                >
                  <Volume2 size={16} />
                  <span>{t.listenAudioBtn}</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              <div>
                {/* Clinical Diagnosis */}
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t.diagnosisLabel}
                  </span>
                  <div style={{
                    marginTop: 6,
                    padding: '14px 18px',
                    background: '#f8fafc',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '1.02rem',
                    color: '#0f172a',
                    lineHeight: 1.5
                  }}>
                    {dynAssessment || signedNote?.assessment || "Acute uncomplicated right ureteric colic secondary to 4.1mm distal stone (ICD-10: N20.1)."}
                  </div>
                </div>

                {/* Prescribed Medications */}
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t.prescriptionsLabel}
                  </span>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="med-card portal-med-card">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Pill size={16} color="#5568d7" />
                          <strong style={{ fontSize: '0.98rem' }}>Tamsulosin 0.4mg</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>
                          {language === 'kn' ? 'ದಿನಕ್ಕೆ 1 ಮಾತ್ರೆ ರಾತ್ರಿ ಮಲಗುವಾಗ · 14 ದಿನಗಳವರೆಗೆ' : language === 'hi' ? 'प्रतिदिन 1 गोली रात को सोते समय · 14 दिनों तक' : '1 tablet daily at bedtime · 14 days course'}
                        </div>
                      </div>
                      <span className="med-timing-badge">🌙 Night (ರಾತ್ರಿ / रात)</span>
                    </div>

                    <div className="med-card portal-med-card">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Pill size={16} color="#5568d7" />
                          <strong style={{ fontSize: '0.98rem' }}>Paracetamol 650mg</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>
                          {language === 'kn' ? 'ನೋವು ಬಂದಾಗ ಮಾತ್ರ ತೆಗೆದುಕೊಳ್ಳಿ (ದಿನಕ್ಕೆ ಗರಿಷ್ಠ 3 ಬಾರಿ) · 5 ದಿನಗಳು' : language === 'hi' ? 'केवल दर्द होने पर लें (अधिकतम 3 गोली/दिन) · 5 दिन' : 'Take only if pain occurs (Max 3/day) · 5 days'}
                        </div>
                      </div>
                      <span className="med-timing-badge">☀️ SOS Pain (ನೋವಿದ್ದಾಗ)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                {/* Dietary Advice & Red Flags */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 18
                }}>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#5568d7', display: 'block', marginBottom: 6 }}>
                    {t.dietaryLabel}
                  </span>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: '#334155' }}>
                    {dynDiet || "Drink at least 2.5 to 3 Litres of clean water daily. Avoid excessive tea, spinach, and high-oxalate foods until stone passes."}
                  </p>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#dc2626', display: 'block', marginBottom: 6 }}>
                      {t.redFlagsLabel}
                    </span>
                    <p style={{ fontSize: '0.88rem', color: '#991b1b', lineHeight: 1.5 }}>
                      {dynRedFlags || "Visit hospital casualty immediately if you get high-grade fever with chills, or if you cannot pass urine."}
                    </p>
                  </div>
                </div>

                {/* 48-Hour Interactive Follow-Up */}
                <div style={{
                  background: '#f0f4ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: 16,
                  padding: 18
                }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#3730a3', display: 'block', marginBottom: 10 }}>
                    {t.followupPrompt}
                  </span>
                  <div className="followup-option-row">
                    <button
                      type="button"
                      className={`followup-btn ${followupResponse === 'better' ? 'selected' : ''}`}
                      onClick={() => setFollowupResponse('better')}
                    >
                      {t.feelingBetter}
                    </button>
                    <button
                      type="button"
                      className={`followup-btn ${followupResponse === 'same' ? 'selected' : ''}`}
                      onClick={() => setFollowupResponse('same')}
                    >
                      {t.noChange}
                    </button>
                    <button
                      type="button"
                      className={`followup-btn ${followupResponse === 'help' ? 'selected' : ''}`}
                      style={{ color: '#dc2626' }}
                      onClick={() => setFollowupResponse('help')}
                    >
                      {t.needHelp}
                    </button>
                  </div>

                  {followupResponse === 'help' && (
                    <div style={{
                      marginTop: 12,
                      padding: 10,
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                      color: '#991b1b',
                      fontWeight: 600
                    }}>
                      🚨 Priority tele-triage alert dispatched to Dr. Ananya Sharma's emergency queue. Clinic coordinator notified.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PATIENT PROFILE & AUTHORITY SETTINGS */}
      {activeTab === 'profile' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            <div className="cb-card-header">
              <div className="cb-card-title">
                <UserCheck size={20} color="#5568d7" />
                <span>{t.patientCardTitle}</span>
              </div>
              <span className="audit-pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                ABDM Verified Registry
              </span>
            </div>

            {/* Profile Detail Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 20
            }}>
              <div className="portal-info-box">
                <span className="portal-info-label">{t.nameLabel}</span>
                <strong className="portal-info-value">{displayName}</strong>
              </div>
              <div className="portal-info-box">
                <span className="portal-info-label">{t.abhaLabel}</span>
                <span className="audit-pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                  {abhaAddress}
                </span>
              </div>
              <div className="portal-info-box">
                <span className="portal-info-label">{t.districtLabel}</span>
                <strong className="portal-info-value">{demoDistrict}</strong>
              </div>
              <div className="portal-info-box">
                <span className="portal-info-label">Demographics:</span>
                <strong className="portal-info-value">Age: {demoAge} · {demoGender.toUpperCase()} · No: {demoAbhaNumber}</strong>
              </div>
            </div>

            {/* Medical History Section */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Heart size={18} color="#dc2626" />
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    ABDM Medical History & Health Records (ವೈದ್ಯಕೀಯ ಇತಿಹಾಸ)
                  </h4>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '5px 12px', fontSize: '0.78rem', minHeight: 'auto', gap: 5, background: '#f8fafc' }}
                  onClick={() => setIsAddRecordModalOpen(true)}
                >
                  <Plus size={13} />
                  <span>Update Medical History</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {/* Chronic Illnesses */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Chronic Conditions
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {medHist.chronic_conditions && medHist.chronic_conditions.length > 0 ? (
                      medHist.chronic_conditions.map((c: string, i: number) => (
                        <span key={i} className="audit-pill" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.78rem' }}>
                          ● {c}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>None documented</span>
                    )}
                  </div>
                </div>

                {/* Active Meds */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Current Active Medications
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(medHist.active_medications || medHist.current_medications) && (medHist.active_medications || medHist.current_medications).length > 0 ? (
                      (medHist.active_medications || medHist.current_medications).map((m: string, i: number) => (
                        <span key={i} className="audit-pill" style={{ background: '#eff6ff', color: '#1e40af', fontSize: '0.78rem' }}>
                          💊 {m}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No medications listed</span>
                    )}
                  </div>
                </div>

                {/* Allergies */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Known Drug & Food Allergies
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {medHist.allergies && medHist.allergies.length > 0 ? (
                      medHist.allergies.map((a: string, i: number) => (
                        <span key={i} className="audit-pill" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.78rem' }}>
                          ⚠️ {a}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>No known allergies</span>
                    )}
                  </div>
                </div>

                {/* Surgeries & Blood Group */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Blood Group & Surgeries
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="audit-pill" style={{ background: '#fdf2f8', color: '#9d174d', fontWeight: 800 }}>
                      🩸 Blood: {medHist.blood_group || "O+"}
                    </span>
                    {medHist.surgeries && medHist.surgeries.length > 0 && medHist.surgeries[0] !== "None" ? (
                      medHist.surgeries.map((s: string, i: number) => (
                        <span key={i} className="audit-pill" style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.78rem' }}>
                          {s}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No major surgeries</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Treating Doctor Visit & Consultation History */}
              {medHist.consultations && medHist.consultations.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Treating Doctor Visit History ({medHist.consultations.length} visits)
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {medHist.consultations.map((cons: any, idx: number) => (
                      <div key={idx} style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: '0.84rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <strong style={{ color: '#1e40af' }}>{cons.doctor_name || 'Dr. Physician'}</strong>
                          <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{cons.timestamp?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div style={{ color: '#334155', lineHeight: 1.4 }}>{cons.clinical_notes}</div>
                        {cons.new_diagnoses && cons.new_diagnoses.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b' }}>New Diagnoses:</span>
                            {cons.new_diagnoses.map((d: string, dIdx: number) => (
                              <span key={dIdx} className="audit-pill" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.75rem' }}>
                                ● {d}
                              </span>
                            ))}
                          </div>
                        )}
                        {cons.prescriptions && cons.prescriptions.length > 0 && (
                          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af' }}>Prescriptions:</span>
                            {cons.prescriptions.map((p: string, pIdx: number) => (
                              <span key={pIdx} className="audit-pill" style={{ background: '#eff6ff', color: '#1e40af', fontSize: '0.75rem' }}>
                                💊 {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Representative Authority Check */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              borderRadius: 16
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  {t.participantQuestion}
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.92rem' }}>
                  <input
                    type="radio"
                    name="participantRole"
                    checked={!isRepresentative}
                    onChange={() => setIsRepresentative(false)}
                  />
                  <span>{t.patientSelf}</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.92rem' }}>
                  <input
                    type="radio"
                    name="participantRole"
                    checked={isRepresentative}
                    onChange={() => setIsRepresentative(true)}
                  />
                  <span>{t.authRepresentative}</span>
                </label>
              </div>

              {isRepresentative && (
                <div style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  background: '#e0f2fe',
                  borderRadius: 10,
                  fontSize: '0.88rem',
                  color: '#075985',
                  border: '1px solid #bae6fd'
                }}>
                  <strong>{t.repDisclaimer}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Medical Record & History Modal */}
      <AddMedicalRecordModal
        isOpen={isAddRecordModalOpen}
        onClose={() => setIsAddRecordModalOpen(false)}
        language={language}
        patientId={session?.user_id || 'usr_ramesh_gowda'}
        onRecordAdded={(newRecord) => {
          if (onRecordAdded) onRecordAdded(newRecord);
        }}
        onMedicalHistoryUpdated={(updatedHist) => {
          setPatientProfile((prev: any) => ({
            ...prev,
            demographics: {
              ...(prev?.demographics || {}),
              medical_history: updatedHist
            }
          }));
        }}
      />
    </div>
  );
};

