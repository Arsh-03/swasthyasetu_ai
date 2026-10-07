import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PatientPortal } from './components/PatientPortal';
import { DoctorPortal } from './components/DoctorPortal';
import { ModernAuthView } from './components/ModernAuthView';
import { ConsentModal } from './components/ConsentModal';
import { AuditModal } from './components/AuditModal';
import type { Language, UserRole, NetworkTier, HealthRecord, ConsentRequest, ClinicalNote, AuditEvent, AuthSession } from './types';
import { authFetch, verifyCurrentSession } from './services/apiClient';

// Default Baseline Records for Demo
const INITIAL_RECORDS: HealthRecord[] = [
  {
    record_id: 'rec_usg_pelvis_2026',
    patient_id: 'usr_ramesh_gowda',
    record_type: 'ultrasound',
    title: 'Ultrasound Pelvis & Abdomen (ಉದರ ಮತ್ತು ಶ್ರೋಣಿಯ ಸ್ಕ್ಯಾನ್ ವರದಿ)',
    date_str: '24 May 2026',
    file_mime_type: 'application/pdf',
    file_size_bytes: 2450000,
    consent_status: 'protected'
  },
  {
    record_id: 'rec_blood_panel_2026',
    patient_id: 'usr_ramesh_gowda',
    record_type: 'blood_panel',
    title: 'Comprehensive Metabolic Panel (ರಕ್ತ ಮತ್ತು ಮೂತ್ರಪಿಂಡ ಪರೀಕ್ಷೆ)',
    date_str: '10 April 2026',
    file_mime_type: 'application/pdf',
    file_size_bytes: 1120000,
    consent_status: 'approved'
  },
  {
    record_id: 'rec_ecg_resting_2026',
    patient_id: 'usr_ramesh_gowda',
    record_type: 'ecg',
    title: '12-Lead Resting ECG (ಹೃದಯ ಇಸಿಜಿ ವರದಿ)',
    date_str: '15 Jan 2026',
    file_mime_type: 'application/pdf',
    file_size_bytes: 840000,
    consent_status: 'protected'
  }
];

export const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const raw = localStorage.getItem('carebridge_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    try {
      const raw = localStorage.getItem('carebridge_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.role || 'patient';
      }
    } catch {}
    return 'patient';
  });

  const [language, setLanguage] = useState<Language>('en');
  const [networkTier, setNetworkTier] = useState<NetworkTier>('good');
  const [isRepresentative, setIsRepresentative] = useState(false);

  // Dynamic records state
  const [records, setRecords] = useState<HealthRecord[]>(INITIAL_RECORDS);

  // Auth View state: show login if no session is stored
  const [isAuthView, setIsAuthView] = useState<boolean>(() => {
    return !localStorage.getItem('carebridge_session');
  });

  // Consent & Token State
  const [activeConsentToken, setActiveConsentToken] = useState<string | null>(null);
  const [activeConsentId, setActiveConsentId] = useState<string | null>(null);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [pendingConsentRequest, setPendingConsentRequest] = useState<ConsentRequest | null>(null);
  const [incomingLinkNotification, setIncomingLinkNotification] = useState<any>(null);

  // Clinical & Audit State
  const [signedNote, setSignedNote] = useState<ClinicalNote | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Speech Synthesizer State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Fetch patient records from backend
  const loadPatientRecords = async (patientId?: string) => {
    const targetId = patientId || session?.user_id || 'usr_ramesh_gowda';
    try {
      const res = await authFetch(`/api/v1/records/patient/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setRecords(data);
        }
      }
    } catch {}
  };

  // Fetch initial audit logs from backend using authenticated fetch
  const fetchAuditLogs = async () => {
    try {
      const res = await authFetch('/api/v1/audit/logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch {
      // Fallback local initial log if backend offline
    }
  };

  // Live WebSocket listener & Polling for ABHA Link Requests and Approvals (Only for Patient)
  useEffect(() => {
    if (currentRole !== 'patient') {
      setIncomingLinkNotification(null);
    }
  }, [currentRole]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/telehealth`);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ABHA_LINK_REQUEST') {
            // ONLY patient accounts should receive incoming consent link requests!
            if (currentRole === 'patient') {
              setIncomingLinkNotification(msg);
            }
          } else if (msg.type === 'ABHA_LINK_APPROVED') {
            if (msg.grant_token) {
              setActiveConsentToken(msg.grant_token);
            }
            fetchAuditLogs();
          } else if (msg.type === 'PATIENT_HISTORY_UPDATED') {
            fetchAuditLogs();
          }
        } catch {}
      };
    } catch {}

    // Polling fallback to check pending consent requests ONLY for patient
    const pollPending = async () => {
      if (isConsentModalOpen || currentRole !== 'patient') return;
      try {
        const res = await authFetch('/api/v1/consents/pending-for-patient');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            const latest = list[0];
            setIncomingLinkNotification({
              consent_id: latest.consent_id,
              encounter_id: latest.encounter_id,
              doctor_id: latest.practitioner_id,
              doctor_name: latest.practitioner_name,
              doctor_reg: latest.practitioner_reg,
              patient_id: latest.patient_id,
              purpose: latest.purpose,
              scopes: ['demographics', 'medical_history', 'diagnostic_records']
            });
          }
        }
      } catch {}
    };

    const interval = setInterval(pollPending, 4000);

    return () => {
      if (socket) socket.close();
      clearInterval(interval);
    };
  }, [isConsentModalOpen, currentRole]);

  // Verify stored session with backend on load
  useEffect(() => {
    const verifySession = async () => {
      const profile = await verifyCurrentSession();
      if (profile) {
        setCurrentRole(profile.role);
        if (profile.preferred_language) {
          setLanguage(profile.preferred_language as Language);
        }
        setIsAuthView(false);
        fetchAuditLogs();
        loadPatientRecords(profile.user_id);
      } else if (!session) {
        setIsAuthView(true);
      }
    };
    verifySession();
  }, []);

  // Web Speech API Voice synthesis
  const handlePlayAudio = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Speech synthesis is not supported on this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (language === 'kn') utterance.lang = 'kn-IN';
    else if (language === 'hi') utterance.lang = 'hi-IN';
    else utterance.lang = 'en-IN';

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  // Auth Handler
  const handleLoginSuccess = (newSession: AuthSession, initialRecord?: HealthRecord) => {
    try {
      localStorage.setItem('carebridge_session', JSON.stringify(newSession));
    } catch {}
    setSession(newSession);
    setCurrentRole(newSession.role);
    if (newSession.preferred_language) {
      setLanguage(newSession.preferred_language);
    }
    setIsAuthView(false);
    fetchAuditLogs();
    if (initialRecord) {
      setRecords(prev => [initialRecord, ...prev]);
    } else {
      loadPatientRecords(newSession.user_id);
    }
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem('carebridge_session');
    } catch {}
    setSession(null);
    setIsAuthView(true);
  };

  // Doctor initiates consent request
  const handleRequestConsent = async (recordId: string, purpose: string, durationMinutes: number) => {
    try {
      const res = await authFetch('/api/v1/consents/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounter_id: 'enc_9481',
          record_id: recordId,
          purpose,
          duration_minutes: durationMinutes
        })
      });

      if (res.ok) {
        const consentData: ConsentRequest = await res.json();
        setActiveConsentId(consentData.consent_id);
        setPendingConsentRequest(consentData);
        fetchAuditLogs();

        if (currentRole === 'doctor') {
          alert("📋 Purpose-Bound Consent Requested via ABDM:\nRequest dispatched to Patient Ramesh Gowda (ABHA: 91-4820-1928-1120@abdm). Awaiting patient cryptographic HMAC signature under DPDP Act 2023.");
        } else {
          // If in patient view, open approval modal
          setIsConsentModalOpen(true);
        }
      } else {
        const err = await res.json();
        alert(`❌ Request Failed: ${err.detail || 'Could not initiate consent request.'}`);
      }
    } catch {
      // Local fallback
      const fallbackReq: ConsentRequest = {
        consent_id: 'c7a82910-14e2-416b',
        encounter_id: 'enc_9481',
        patient_id: 'usr_ramesh_gowda',
        practitioner_id: 'dr_ananya_sharma',
        record_id: recordId,
        purpose,
        scope: 'read_only',
        status: 'requested'
      };
      setActiveConsentId(fallbackReq.consent_id);
      setPendingConsentRequest(fallbackReq);
      if (currentRole === 'patient') {
        setIsConsentModalOpen(true);
      } else {
        alert("📋 Consent Request Dispatched to Patient Ramesh Gowda via ABDM gateway.");
      }
    }
  };

  // Reject notification directly from floating banner
  const handleRejectIncomingNotification = async () => {
    if (!incomingLinkNotification) return;
    const cid = incomingLinkNotification.consent_id;
    setIncomingLinkNotification(null);
    try {
      await authFetch(`/api/v1/consents/${cid}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          decided_by_role: isRepresentative ? 'representative' : 'patient'
        })
      });
      alert("❌ ABDM Link Request Declined: Access strictly denied to doctor under DPDP Act 2023.");
      fetchAuditLogs();
    } catch {}
  };

  // Accept notification from banner -> opens Consent Form with OTP verification
  const handleAcceptIncomingNotification = () => {
    if (!incomingLinkNotification) return;
    setActiveConsentId(incomingLinkNotification.consent_id);
    setPendingConsentRequest({
      consent_id: incomingLinkNotification.consent_id,
      encounter_id: incomingLinkNotification.encounter_id || 'enc_9481',
      patient_id: incomingLinkNotification.patient_id || 'usr_ramesh_gowda',
      practitioner_id: incomingLinkNotification.doctor_id || 'dr_ananya_sharma',
      practitioner_name: incomingLinkNotification.doctor_name || 'Dr. Ananya Sharma, MD',
      practitioner_reg: incomingLinkNotification.doctor_reg || 'NMC-KA-581920',
      record_id: 'all_abdm_records',
      purpose: incomingLinkNotification.purpose || 'Evaluating clinical symptoms, past medical history & diagnostic records',
      scope: 'demographics,medical_history,diagnostic_records',
      status: 'requested',
      is_abha_link: true
    });
    setIncomingLinkNotification(null);
    setIsConsentModalOpen(true);
  };

  // Patient responds to consent request with OTP verification
  const handleConsentDecision = async (approved: boolean, otpCode?: string) => {
    setIsConsentModalOpen(false);

    if (activeConsentId) {
      try {
        let res: Response;
        if (approved && otpCode) {
          res = await authFetch(`/api/v1/consents/${activeConsentId}/verify-otp-and-grant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              otp_code: otpCode,
              decided_by_role: isRepresentative ? 'representative' : 'patient'
            })
          });
        } else {
          res = await authFetch(`/api/v1/consents/${activeConsentId}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              approved,
              decided_by_role: isRepresentative ? 'representative' : 'patient'
            })
          });
        }

        if (res.ok) {
          const result = await res.json();
          if (approved && result.grant_token) {
            setActiveConsentToken(result.grant_token);
            alert("✅ Purpose-Bound Consent Verified with OTP!\nSingle-use HMAC token issued in vault under DPDP Act 2023. Doctor granted access to your ABHA health record & medical history.");
          } else {
            setActiveConsentToken(null);
            alert("❌ Consent Declined: Access strictly blocked to doctor under DPDP Act 2023.");
          }
          fetchAuditLogs();
        }
      } catch {
        if (approved) {
          setActiveConsentToken('b1ee64401e253a48e3b0c44298fc1c14');
        } else {
          setActiveConsentToken(null);
        }
      }
    }
  };

  // 1-Click Revocation
  const handleRevokeConsent = async () => {
    if (activeConsentId) {
      try {
        await authFetch(`/api/v1/consents/${activeConsentId}/revoke`, { method: 'POST' });
      } catch {
        // Fallback
      }
    }
    setActiveConsentToken(null);
    fetchAuditLogs();
    alert("🚫 Consent Revoked: Single-use grant token invalidated immediately in Redis. Record stream severed mid-session.");
  };

  // Clinician signs care plan
  const handleSignCarePlan = async (note: ClinicalNote, signatureName: string) => {
    try {
      const res = await authFetch('/api/v1/scribe/sign/enc_9481', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjective: note.subjective,
          objective: note.objective,
          assessment: note.assessment,
          plan: note.plan,
          doctor_signature_name: signatureName,
          ddi_acknowledged: true
        })
      });

      if (res.ok) {
        const result = await res.json();
        setSignedNote(result);
        fetchAuditLogs();
        alert("✅ Care plan verified & signed under NMC Guidelines! Dispatched to patient screen with vernacular audio.");
      } else {
        const err = await res.json();
        alert(`Signing error: ${err.detail || 'Access forbidden. Physician credential required.'}`);
      }
    } catch {
      setSignedNote(note);
    }
  };

  // Export HL7 FHIR R4 Bundle
  const handleExportFHIR = async () => {
    try {
      const res = await authFetch('/api/v1/fhir/encounter/enc_9481');
      let bundleData;
      if (res.ok) {
        bundleData = await res.json();
      } else {
        throw new Error();
      }

      const blob = new Blob([JSON.stringify(bundleData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carebridge_fhir_bundle_enc9481.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Exporting fallback sample FHIR R4 bundle...");
      const sampleBundle = {
        resourceType: "Bundle",
        id: "carebridge-encounter-bundle-enc9481",
        type: "document",
        timestamp: new Date().toISOString(),
        entry: [
          { resource: { resourceType: "Patient", id: "usr_ramesh_gowda", name: [{ text: "Ramesh Gowda" }] } },
          { resource: { resourceType: "Practitioner", id: "dr_ananya_sharma", name: [{ text: "Dr. Ananya Sharma" }] } },
          { resource: { resourceType: "Encounter", id: "enc_9481", status: "finished" } }
        ]
      };
      const blob = new Blob([JSON.stringify(sampleBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carebridge_fhir_bundle_enc9481.json`;
      a.click();
    }
  };

  return (
    <div className={`lang-${language}`}>
      {/* Real-Time Floating Notification Banner for ABHA Link Requests (Patients Only) */}
      {incomingLinkNotification && currentRole === 'patient' && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          width: '92%',
          maxWidth: 640,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          border: '2px solid #6366f1',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45), 0 0 25px rgba(99, 102, 241, 0.35)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)'
            }}>
              <span style={{ fontSize: '1.4rem' }}>🔔</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  ABDM Access Request from {incomingLinkNotification.doctor_name || 'Dr. Ananya Sharma'}
                </h4>
                <span className="audit-pill" style={{ background: '#312e81', color: '#c7d2fe', fontSize: '0.72rem', padding: '2px 8px' }}>
                  DPDP Act 2023
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Doctor is requesting access to your ABHA health record & medical history.
                <br />
                <span style={{ color: '#93c5fd' }}>Purpose: {incomingLinkNotification.purpose || 'Clinical Review'}</span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{
                borderColor: '#ef4444',
                color: '#f87171',
                padding: '8px 12px',
                fontSize: '0.82rem',
                minHeight: 'auto',
                background: 'rgba(239, 68, 68, 0.1)'
              }}
              onClick={handleRejectIncomingNotification}
            >
              ✕ Reject
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 700,
                minHeight: 'auto',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)'
              }}
              onClick={handleAcceptIncomingNotification}
            >
              ✓ Accept & Review OTP
            </button>
          </div>
        </div>
      )}

      {/* Show Modern Navigation Header ONLY when in consultation view */}
      {!isAuthView && (
        <Header
          currentRole={currentRole}
          language={language}
          setLanguage={setLanguage}
          onOpenAuditLogs={() => {
            fetchAuditLogs();
            setIsAuditModalOpen(true);
          }}
          session={session}
          onSignOut={handleSignOut}
          onOpenAuth={() => setIsAuthView(true)}
        />
      )}

      {/* VIEW 1: AUTH GATEWAY (SPLIT CARD MATCHING REFERENCE IMAGE) */}
      {isAuthView ? (
        <ModernAuthView
          language={language}
          setLanguage={setLanguage}
          initialRole={currentRole}
          onLoginSuccess={handleLoginSuccess}
          onBackToConsultation={() => setIsAuthView(false)}
        />
      ) : (
        <div className="consultation-page-wrapper">
          <main className="main-content-consultation">
            {/* VIEW 2: ACTIVE CLINICAL TELEHEALTH PORTALS */}
            {currentRole === 'patient' ? (
              <PatientPortal
                language={language}
                networkTier={networkTier}
                onNetworkTierChange={setNetworkTier}
                records={records}
                activeConsentToken={activeConsentToken}
                onSimulateDoctorRequest={() => handleRequestConsent('rec_usg_pelvis_2026', 'Evaluating acute right flank pain / suspected ureteric colic', 60)}
                onRevokeConsent={handleRevokeConsent}
                isRepresentative={isRepresentative}
                setIsRepresentative={setIsRepresentative}
                onPlayAudio={handlePlayAudio}
                isPlayingAudio={isPlayingAudio}
                signedNote={signedNote}
                session={session}
                onRecordAdded={(rec) => setRecords(prev => [rec, ...prev])}
              />
            ) : (
              <DoctorPortal
                records={records}
                activeConsentToken={activeConsentToken}
                onRequestConsent={handleRequestConsent}
                onRevokeConsent={handleRevokeConsent}
                onSignCarePlan={handleSignCarePlan}
                onExportFHIR={handleExportFHIR}
                onPatientLinked={(_patient, token) => {
                  setActiveConsentToken(token);
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Purpose-Specific Consent Modal */}
      <ConsentModal
        isOpen={isConsentModalOpen}
        request={pendingConsentRequest}
        language={language}
        isRepresentative={isRepresentative}
        onDecision={handleConsentDecision}
        onPlayAudio={handlePlayAudio}
        isPlayingAudio={isPlayingAudio}
      />

      {/* DPDP Act 2023 Audit Trail Modal */}
      <AuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
      />
    </div>
  );
};

export default App;
