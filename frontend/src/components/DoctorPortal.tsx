import React, { useState, useEffect } from 'react';
import type { HealthRecord, ClinicalNote } from '../types';
import { dynamicTranslator } from '../services/translator';
import { authFetch } from '../services/apiClient';
import { LinkPatientModal } from './LinkPatientModal';
import {
  Stethoscope, ShieldAlert, Send, FileCheck, Download, AlertTriangle,
  Lock, Unlock, Clock, Sparkles, Activity, FileText, CheckCircle2,
  UserPlus, Plus, Heart, Save, Database
} from 'lucide-react';

interface DoctorPortalProps {
  records: HealthRecord[];
  activeConsentToken: string | null;
  onRequestConsent: (recordId: string, purpose: string, durationMinutes: number) => void;
  onRevokeConsent: () => void;
  onSignCarePlan: (note: ClinicalNote, signatureName: string) => void;
  onExportFHIR: () => void;
  onPatientLinked?: (patient: any, token: string) => void;
}

type DoctorTab = 'triage' | 'records' | 'scribe' | 'update_history' | 'fhir';

export const DoctorPortal: React.FC<DoctorPortalProps> = ({
  records,
  activeConsentToken,
  onRequestConsent,
  onRevokeConsent,
  onSignCarePlan,
  onExportFHIR,
  onPatientLinked
}) => {
  const [activeTab, setActiveTab] = useState<DoctorTab>('triage');

  // Link Patient Modal & Active Patient State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [activePatient, setActivePatient] = useState<any>({
    patient_id: 'usr_ramesh_gowda',
    full_name: 'Ramesh Gowda',
    abha_address: '91-4820-1928-1120@abdm',
    phone_number: '9845012345',
    preferred_language: 'kn',
    demographics: {
      age: 54,
      gender: 'Male',
      district: 'Hassan, Karnataka',
      blood_group: 'O+',
      medical_history: {
        chronic_conditions: ['Right Distal Ureteric Calculus (4.1mm)', 'Mild Hydronephrosis'],
        active_medications: ['Gelusil Antacid Suspension 10ml TDS', 'Paracetamol 650mg PRN'],
        allergies: ['Penicillin (Urticarial Rash)'],
        consultations: [
          {
            consultation_id: 'cons_9481',
            timestamp: '2026-05-24 10:30 UTC',
            doctor_name: 'Dr. Ananya Sharma',
            clinical_notes: 'Acute flank pain presentation. PHC Hassan triage recorded.',
            new_diagnoses: ['Ureteric Calculus'],
            prescriptions: ['Tamsulosin 0.4mg OD']
          }
        ]
      }
    }
  });

  // Staged history update form state
  const [newConditionInput, setNewConditionInput] = useState('');
  const [newMedInput, setNewMedInput] = useState('');
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [stagedConditions, setStagedConditions] = useState<string[]>([]);
  const [stagedMedications, setStagedMedications] = useState<string[]>([]);
  const [postVisitNotes, setPostVisitNotes] = useState(
    'Acute colicky right flank pain evaluated. Hydration therapy (3L fluid daily) initiated. Low-oxalate dietary regime advised. Review after 14 days or immediately if fever/anuria develops.'
  );
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [historySaveMessage, setHistorySaveMessage] = useState<string | null>(null);

  // Fetch active patient profile details on mount
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const res = await authFetch(`/api/v1/auth/patient/${activePatient.patient_id}/details`);
        if (res.ok) {
          const data = await res.json();
          setActivePatient(data);
        }
      } catch {}
    };
    fetchPatientData();
  }, []);

  const handlePatientLinked = async (patientData: any, token: string) => {
    try {
      const pid = patientData.patient_id || patientData.abha_address;
      const res = await authFetch(`/api/v1/auth/patient/${pid}/details`);
      if (res.ok) {
        const fullData = await res.json();
        setActivePatient(fullData);
      } else {
        setActivePatient({
          patient_id: patientData.patient_id || 'pat_linked',
          full_name: patientData.patient_name || patientData.full_name || 'Verified Patient',
          abha_address: patientData.abha_address,
          phone_number: '9845012345',
          preferred_language: 'kn',
          demographics: patientData.demographics || {
            age: 38,
            gender: 'Male',
            district: 'Bengaluru, Karnataka',
            medical_history: {
              chronic_conditions: [],
              active_medications: [],
              allergies: []
            }
          }
        });
      }
    } catch {
      setActivePatient((prev: any) => ({
        ...prev,
        patient_id: patientData.patient_id,
        full_name: patientData.patient_name || patientData.full_name,
        abha_address: patientData.abha_address
      }));
    }
    if (onPatientLinked) {
      onPatientLinked(patientData, token);
    }
    setActiveTab('update_history');
  };

  const handleAddCondition = (cond: string) => {
    const c = cond.trim();
    if (c && !stagedConditions.includes(c)) {
      setStagedConditions(prev => [...prev, c]);
      setNewConditionInput('');
    }
  };

  const handleRemoveCondition = (cond: string) => {
    setStagedConditions(prev => prev.filter(x => x !== cond));
  };

  const handleAddMedication = (med: string) => {
    const m = med.trim();
    if (m && !stagedMedications.includes(m)) {
      setStagedMedications(prev => [...prev, m]);
      setNewMedInput('');
    }
  };

  const handleRemoveMedication = (med: string) => {
    setStagedMedications(prev => prev.filter(x => x !== med));
  };

  const handleSaveDoctorHistory = async () => {
    setIsSavingHistory(true);
    setHistorySaveMessage(null);
    try {
      const res = await authFetch(`/api/v1/auth/patient/${activePatient.patient_id}/doctor-update-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_conditions: stagedConditions,
          prescribed_medications: stagedMedications,
          updated_allergies: newAllergyInput.trim() ? [newAllergyInput.trim()] : [],
          clinical_notes: postVisitNotes
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActivePatient((prev: any) => ({
          ...prev,
          demographics: {
            ...prev.demographics,
            medical_history: data.medical_history
          }
        }));
        setStagedConditions([]);
        setStagedMedications([]);
        setNewAllergyInput('');
        setHistorySaveMessage(`✅ Successfully committed to ABHA Database for ${activePatient.full_name}! Medical history updated.`);
        setTimeout(() => setHistorySaveMessage(null), 5000);
      } else {
        const err = await res.json();
        alert(`Failed to update medical history: ${err.detail || 'Error saving to database.'}`);
      }
    } catch (e: any) {
      alert(`Network error: ${e.message}`);
    } finally {
      setIsSavingHistory(false);
    }
  };

  const [selectedRecordId, setSelectedRecordId] = useState('rec_usg_pelvis_2026');
  const [purpose, setPurpose] = useState('Evaluating acute right flank pain / suspected ureteric colic');
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Remaining token seconds simulation
  const [remainingSeconds, setRemainingSeconds] = useState(3585);
  useEffect(() => {
    if (!activeConsentToken) return;
    const interval = setInterval(() => {
      setRemainingSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeConsentToken]);

  // Draft Clinical Note State
  const [subjective, setSubjective] = useState(
    "54-year-old male presenting with acute colicky right flank pain radiating to groin for 3 days. Mild nausea, no active emesis or gross macroscopic hematuria."
  );
  const [objective, setObjective] = useState(
    "Vitals: BP: 130/84 mmHg, HR: 78 bpm, Temp: 98.4°F. Abdomen: Tenderness over right renal angle, soft, no guarding. Ultrasound: Mild right hydronephrosis with 4.1mm calculus at right vesicoureteric junction (VUJ)."
  );
  const [assessment, setAssessment] = useState(
    "Acute uncomplicated right ureteric colic secondary to 4.1mm distal stone (ICD-10: N20.1)."
  );
  const [ddiAcknowledged, setDdiAcknowledged] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const doctorSigName = 'Dr. Ananya Sharma, MD';

  // Dynamic Translation Preview State
  const [previewLang, setPreviewLang] = useState<'kn' | 'hi'>('kn');
  const [vernacularPreview, setVernacularPreview] = useState<string>('');
  const [isPreviewTranslating, setIsPreviewTranslating] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const updatePreview = async () => {
      setIsPreviewTranslating(true);
      const res = await dynamicTranslator.translateText(assessment, previewLang);
      if (active) {
        setVernacularPreview(res);
        setIsPreviewTranslating(false);
      }
    };
    updatePreview();
    return () => { active = false; };
  }, [assessment, previewLang]);


  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleSign = () => {
    if (!ddiAcknowledged) {
      alert("⚠️ Mandatory Clinician Gate: You must check the DDI Safety acknowledgment box before signing.");
      return;
    }
    const signedData: ClinicalNote = {
      note_id: 'note_enc_9481',
      encounter_id: 'enc_9481',
      subjective,
      objective,
      assessment,
      plan: {
        medications: [
          { drug: "Tamsulosin", dosage: "0.4mg", frequency: "OD at bedtime", duration: "14 days", timing_icon: "🌙" },
          { drug: "Paracetamol", dosage: "650mg", frequency: "SOS for pain", duration: "5 days", timing_icon: "☀️" },
          { drug: "Ciprofloxacin", dosage: "500mg", frequency: "BD after food", duration: "5 days", timing_icon: "☀️🌙" }
        ],
        dietary_advice: "Hydration therapy (3L daily fluid). Avoid excessive oxalate foods.",
        red_flags: "Emergency visit if high fever, chills, or inability to pass urine occurs."
      },
      status: 'clinician_approved',
      clinician_signature: `NMC-SIG-SHA256:79557044bf4b2660`,
      signed_at: new Date().toISOString()
    };
    setIsSigned(true);
    onSignCarePlan(signedData, doctorSigName);
  };

  return (
    <div className="portal-container-theme">
      {/* Top Hero Card matching Login Aesthetic */}
      <div className="portal-hero-card">
        <div className="portal-hero-left">
          <div className="portal-hero-avatar doctor">👩‍⚕️</div>
          <div>
            <div className="portal-hero-badge-row">
              <span className="portal-role-tag doctor">NMC Tele-Physician Console</span>
              <span className="portal-abha-chip doctor">Reg: #KA-581920 (Verified)</span>
              <span className="portal-rep-badge doctor">Encounter #ENC-9481</span>
            </div>
            <h2 className="portal-hero-title">Dr. Ananya Sharma, MD</h2>
            <p className="portal-hero-subtitle">
              Department of General Medicine & Tele-triage · Patient: <strong>{activePatient.full_name}</strong> ({activePatient.demographics?.age || 54}/{activePatient.demographics?.gender?.charAt(0).toUpperCase() || 'M'}) · ABHA: <span style={{ color: '#4f46e5', fontWeight: 700 }}>{activePatient.abha_address}</span>
            </p>
          </div>
        </div>

        <div className="portal-hero-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 700,
              gap: 6,
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
            onClick={() => setIsLinkModalOpen(true)}
          >
            <UserPlus size={16} />
            <span>➕ Link Patient via ABHA</span>
          </button>
          <div className="portal-header-tag-pill">
            <CheckCircle2 size={15} color="#16a34a" />
            <span>NMC Telemedicine Guidelines Compliant</span>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs for Doctor */}
      <div className="portal-nav-tabs">
        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'triage' ? 'active' : ''}`}
          onClick={() => setActiveTab('triage')}
        >
          <Activity size={16} />
          <span>Patient Triage & Vitals</span>
          <span className="tab-pill-dot green"></span>
        </button>

        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <ShieldAlert size={16} />
          <span>Protected Records & Scans</span>
          {activeConsentToken ? (
            <span className="tab-pill-badge green">Decrypted (HMAC)</span>
          ) : (
            <span className="tab-pill-badge">Encrypted</span>
          )}
        </button>

        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'scribe' ? 'active' : ''}`}
          onClick={() => setActiveTab('scribe')}
        >
          <Sparkles size={16} />
          <span>AI Scribe & CDSS Safety</span>
          <span className="tab-pill-badge red">DDI Alert</span>
        </button>

        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'update_history' ? 'active' : ''}`}
          onClick={() => setActiveTab('update_history')}
        >
          <Heart size={16} />
          <span>Update ABHA History</span>
          <span className="tab-pill-badge blue">Post-Visit</span>
        </button>

        <button
          type="button"
          className={`portal-nav-tab ${activeTab === 'fhir' ? 'active' : ''}`}
          onClick={() => setActiveTab('fhir')}
        >
          <FileText size={16} />
          <span>HL7 FHIR R4 & DPDP Compliance</span>
          {isSigned && <span className="tab-pill-badge blue">Signed</span>}
        </button>
      </div>

      {/* TAB 1: PATIENT TRIAGE & CLINICAL VITALS */}
      {activeTab === 'triage' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            <div className="cb-card-header">
              <div className="cb-card-title">
                <Stethoscope size={20} color="#5568d7" />
                <span>Patient Tele-Consultation Triage Sheet</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="audit-pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                  ABHA: {activePatient.abha_address}
                </span>
              </div>
            </div>

            {/* Patient Clinical Summary Matrix */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 20
            }}>
              <div className="portal-info-box">
                <span className="portal-info-label">Patient Demographics:</span>
                <strong className="portal-info-value" style={{ fontSize: '1.05rem' }}>
                  {activePatient.full_name} ({activePatient.demographics?.age || 54} / {activePatient.demographics?.gender || 'Male'})
                </strong>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                  Location: {activePatient.demographics?.district || 'Karnataka'} · Phone: +91 {activePatient.phone_number || '9845012345'} · Preferred Language: {activePatient.preferred_language === 'kn' ? 'Kannada' : activePatient.preferred_language === 'hi' ? 'Hindi' : 'English'}
                </div>
              </div>

              <div className="portal-info-box" style={{ borderLeft: '4px solid #f59e0b' }}>
                <span className="portal-info-label">Chronic Conditions & History:</span>
                <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.92rem' }}>
                  {activePatient.demographics?.medical_history?.chronic_conditions?.length ?
                    activePatient.demographics.medical_history.chronic_conditions.join(', ') :
                    'No chronic conditions documented'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                  Synchronized from verified ABDM Personal Health Record repository.
                </div>
              </div>

              <div className="portal-info-box" style={{ borderLeft: '4px solid #ef4444' }}>
                <span className="portal-info-label">Allergies & Current Medications:</span>
                <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.88rem' }}>
                  {activePatient.demographics?.medical_history?.allergies?.length ?
                    activePatient.demographics.medical_history.allergies.map((a: string) => `⚠️ ${a}`).join(', ') :
                    'No documented drug allergies'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: 4, fontWeight: 600 }}>
                  Active Meds: {
                    (activePatient.demographics?.medical_history?.active_medications || activePatient.demographics?.medical_history?.current_medications)?.length ?
                    (activePatient.demographics.medical_history.active_medications || activePatient.demographics.medical_history.current_medications).join(' · ') :
                    'None active'
                  }
                </div>
              </div>
            </div>

            {/* Objective Vitals Table */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 18,
              marginBottom: 20
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                Triage Vitals (Recorded at PHC Hassan Triage Station):
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12
              }}>
                <div className="portal-vital-card">
                  <span className="portal-vital-label">Blood Pressure</span>
                  <strong className="portal-vital-val">130/84 mmHg</strong>
                  <span className="portal-vital-status normal">Normal</span>
                </div>
                <div className="portal-vital-card">
                  <span className="portal-vital-label">Heart Rate</span>
                  <strong className="portal-vital-val">78 bpm</strong>
                  <span className="portal-vital-status normal">Regular</span>
                </div>
                <div className="portal-vital-card">
                  <span className="portal-vital-label">Temperature</span>
                  <strong className="portal-vital-val">98.4 °F</strong>
                  <span className="portal-vital-status normal">Afebrile</span>
                </div>
                <div className="portal-vital-card">
                  <span className="portal-vital-label">SpO2 (Room Air)</span>
                  <strong className="portal-vital-val">99%</strong>
                  <span className="portal-vital-status normal">Adequate</span>
                </div>
                <div className="portal-vital-card">
                  <span className="portal-vital-label">Abdominal Exam</span>
                  <strong className="portal-vital-val">Rt Renal Colic</strong>
                  <span className="portal-vital-status warning">Tenderness</span>
                </div>
              </div>
            </div>

            {/* Action Callouts */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveTab('records')}
              >
                <ShieldAlert size={16} />
                <span>Proceed to Protected Ultrasound Scan →</span>
              </button>

              <button
                type="button"
                className="btn btn-outline"
                style={{ background: '#f8fafc' }}
                onClick={() => setActiveTab('scribe')}
              >
                <Sparkles size={16} />
                <span>Open AI Scribe & CDSS Console →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROTECTED RECORDS & SCAN VIEWER */}
      {activeTab === 'records' && (
        <div className="portal-tab-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
            {/* Record Consent Requester */}
            <div className="cb-card portal-card-elevated">
              <div className="cb-card-header">
                <div className="cb-card-title">
                  <ShieldAlert size={19} color="#5568d7" />
                  <span>Request Protected Record Access</span>
                </div>
                <span className="audit-pill" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                  DPDP Purpose-Bound
                </span>
              </div>

              <p style={{ fontSize: '0.86rem', color: '#64748b', marginBottom: 16 }}>
                Specify clinical purpose and access duration. The patient receives an interactive vernacular consent prompt with biometric/ABHA authentication.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="auth-input-label">Diagnostic Record:</label>
                  <select
                    value={selectedRecordId}
                    onChange={(e) => setSelectedRecordId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      background: '#ffffff'
                    }}
                  >
                    {records.map(rec => (
                      <option key={rec.record_id} value={rec.record_id}>
                        {rec.title} ({rec.date_str})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="auth-input-label">Duration:</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      background: '#ffffff'
                    }}
                  >
                    <option value={60}>60 Minutes</option>
                    <option value={120}>2 Hours</option>
                    <option value={1440}>24 Hours</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="auth-input-label">Specific Clinical Purpose:</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Clinical rationale"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                onClick={() => onRequestConsent(selectedRecordId, purpose, durationMinutes)}
              >
                <Send size={16} />
                <span>Dispatch Purpose-Scoped Consent Request</span>
              </button>
            </div>

            {/* Decrypted Scan Viewer Canvas */}
            <div className="cb-card portal-card-elevated">
              <div className="cb-card-header">
                <div className="cb-card-title">
                  {activeConsentToken ? (
                    <>
                      <Unlock size={19} color="#16a34a" />
                      <span style={{ color: '#166534' }}>Decrypted Scan Stream (Active Token)</span>
                    </>
                  ) : (
                    <>
                      <Lock size={19} color="#64748b" />
                      <span>Protected Record Stream</span>
                    </>
                  )}
                </div>
                {activeConsentToken && (
                  <span className="badge-status badge-good">
                    <Clock size={12} />
                    <span>Expires in: {formatTimer(remainingSeconds)}</span>
                  </span>
                )}
              </div>

              {activeConsentToken ? (
                <div>
                  <div className="scan-viewport-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <strong style={{ fontSize: '0.95rem' }}>Ultrasound Pelvis & Abdomen (Hassan Diagnostic Center)</strong>
                      <span className="audit-pill" style={{ background: '#166534', color: '#ffffff', fontWeight: 600 }}>
                        HMAC-SHA256:d8a94e...
                      </span>
                    </div>

                    {/* Simulated DICOM / Scan Canvas */}
                    <div className="scan-image-frame" style={{ marginTop: 12 }}>
                      <div className="scan-crosshairs" />
                      <div style={{ textAlign: 'center', zIndex: 1, padding: 14 }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>🔬</div>
                        <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem' }}>
                          ULTRASOUND B-MODE REAL-TIME CANVAS
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 3 }}>
                          Target: Right Vesicoureteric Junction · Calculus Diameter: 4.1 mm
                        </div>
                        <div style={{
                          marginTop: 8,
                          color: '#4ade80',
                          fontSize: '0.75rem',
                          background: 'rgba(22, 163, 74, 0.25)',
                          padding: '3px 10px',
                          borderRadius: 6,
                          display: 'inline-block',
                          fontWeight: 600
                        }}>
                          Acoustic shadowing confirmed · Pelvicalyceal Grade 1 dilation
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.86rem', color: '#166534', lineHeight: 1.6, marginTop: 12 }}>
                      <strong>Radiologist Finding:</strong> Mild right hydronephrosis with a 4.1mm calculus identified at the right vesicoureteric junction (VUJ). Urinary bladder normal. No perinephric fluid collection.
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span className="audit-pill">
                        Purpose: Acute Flank Pain Assessment
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: 'auto', color: '#dc2626' }}
                        onClick={onRevokeConsent}
                      >
                        Simulate Patient Revocation
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: 16,
                  border: '2px dashed #cbd5e1'
                }}>
                  <Lock size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
                    Record Encrypted in ABDM Vault
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 360, margin: '8px auto 0', lineHeight: 1.5 }}>
                    Under the DPDP Act 2023, patient or authorised representative must approve the purpose-bound request before byte stream is decrypted.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI SCRIBE & CDSS SAFETY GATE */}
      {activeTab === 'scribe' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            <div className="cb-card-header">
              <div className="cb-card-title">
                <Sparkles size={20} color="#5568d7" />
                <span>AI Clinical Scribe & CDSS Console</span>
              </div>
              <span className="audit-pill" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 700 }}>
                Clinician-in-the-Loop Gate
              </span>
            </div>

            {/* CRITICAL DDI Safety Alert */}
            <div className="clinical-alert clinical-alert-danger" style={{ marginBottom: 18 }}>
              <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: '0.95rem' }}>
                  CRITICAL CDSS SAFETY ALERT: Drug-Drug Interaction Detected
                </strong>
                <p style={{ fontSize: '0.85rem', marginTop: 4, lineHeight: 1.5 }}>
                  Prescribing <strong>Ciprofloxacin</strong> alongside patient's active medication <strong>Antacid Suspension (Magnesium/Aluminum Hydroxide)</strong> reduces antibiotic bioavailability by &gt;70% due to chelation binding.
                </p>
                <div style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  background: '#fef2f2',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  border: '1px solid #fca5a5',
                  color: '#991b1b'
                }}>
                  <strong>Citation:</strong> National Formulary of India (NFI) 2021, Section 8.1.3 · Space antibiotic by 2 hours or substitute with Ceftriaxone.
                </div>
              </div>
            </div>

            {/* Editable SOAP Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="auth-input-label">Subjective (Chief Complaint & History):</label>
                <textarea
                  rows={3}
                  value={subjective}
                  onChange={(e) => setSubjective(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div>
                <label className="auth-input-label">Objective (Vitals & Diagnostic Findings):</label>
                <textarea
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="auth-input-label">Assessment & Clinical Diagnosis (ICD-10):</label>
              <textarea
                rows={2}
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            {/* Live Vernacular Patient Translation Preview */}
            <div style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: 14,
              padding: '14px 18px',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} />
                  <span>Live Patient Vernacular Preview (Bhashini AI Indic Dynamic Translation)</span>
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    style={{
                      padding: '3px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      borderRadius: 999,
                      border: '1px solid #c4b5fd',
                      cursor: 'pointer',
                      background: previewLang === 'kn' ? '#6d28d9' : '#ffffff',
                      color: previewLang === 'kn' ? '#ffffff' : '#6d28d9',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setPreviewLang('kn')}
                  >
                    ಕನ್ನಡ (Kannada)
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '3px 10px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      borderRadius: 999,
                      border: '1px solid #c4b5fd',
                      cursor: 'pointer',
                      background: previewLang === 'hi' ? '#6d28d9' : '#ffffff',
                      color: previewLang === 'hi' ? '#ffffff' : '#6d28d9',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setPreviewLang('hi')}
                  >
                    हिन्दी (Hindi)
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#4c1d95', margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                {isPreviewTranslating ? "Translating in real-time..." : (vernacularPreview || assessment)}
              </p>
            </div>

            {/* Mandatory Clinician Sign-Off Gate Checkbox */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 18
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                fontSize: '0.88rem'
              }}>
                <input
                  type="checkbox"
                  checked={ddiAcknowledged}
                  onChange={(e) => setDdiAcknowledged(e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 2 }}
                />
                <span style={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>
                  [Mandatory NMC Telemedicine Gate] I have reviewed the DDI safety warning regarding Ciprofloxacin + Antacids, spaced dosages by &gt;2 hours, and verified the clinical appropriateness of this care plan.
                </span>
              </label>
            </div>

            {/* Actions: Sign & Export */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-success"
                style={{ flex: 1.2, minHeight: 46 }}
                onClick={handleSign}
              >
                <FileCheck size={18} />
                <span>{isSigned ? "✅ Signed & Issued to Patient" : "✍️ Verify, Sign & Issue Care Plan"}</span>
              </button>

              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, minHeight: 46, background: '#f8fafc' }}
                onClick={onExportFHIR}
              >
                <Download size={18} />
                <span>📄 Export FHIR R4 Bundle</span>
              </button>
            </div>

            {isSigned && (
              <div style={{
                marginTop: 14,
                padding: '10px 16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                fontSize: '0.85rem',
                color: '#166534',
                fontWeight: 600
              }}>
                🔒 Cryptographic Doctor Signature Attached: <code>NMC-SIG-SHA256:79557044bf4b2660</code>. Care plan delivered to patient screen with vernacular audio.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: UPDATE ABHA MEDICAL HISTORY (POST-VISIT) */}
      {activeTab === 'update_history' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            <div className="cb-card-header">
              <div className="cb-card-title">
                <Heart size={20} color="#dc2626" />
                <span>Update Patient ABHA Medical History (Post-Visit Sync)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="audit-pill" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                  ABHA: {activePatient.abha_address}
                </span>
                <span className="audit-pill" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                  DPDP Act 2023 Compliant Fiduciary
                </span>
              </div>
            </div>

            {historySaveMessage && (
              <div style={{
                padding: '12px 16px',
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: 10,
                color: '#166534',
                fontSize: '0.88rem',
                fontWeight: 700,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <CheckCircle2 size={18} color="#16a34a" />
                <span>{historySaveMessage}</span>
              </div>
            )}

            {/* Active Patient Summary Banner */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Treating Patient ABHA Identity:
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {activePatient.full_name} ({activePatient.demographics?.age || 54} / {activePatient.demographics?.gender || 'Male'})
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 2 }}>
                  District: {activePatient.demographics?.district || 'Karnataka'} · Phone: +91 {activePatient.phone_number || '9845012345'}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '7px 12px', fontSize: '0.8rem', background: '#ffffff', gap: 6 }}
                onClick={() => setIsLinkModalOpen(true)}
              >
                <UserPlus size={14} />
                <span>Link Another Patient</span>
              </button>
            </div>

            {/* Existing Medical History on Record */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: 14,
              padding: 18,
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Database size={18} color="#4f46e5" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Current ABHA Medical Record on File
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {/* Conditions */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Existing Chronic Conditions
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {activePatient.demographics?.medical_history?.chronic_conditions?.length ? (
                      activePatient.demographics.medical_history.chronic_conditions.map((c: string, idx: number) => (
                        <span key={idx} className="audit-pill" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.8rem' }}>
                          ● {c}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>None documented in registry</span>
                    )}
                  </div>
                </div>

                {/* Active Meds */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Active Prescriptions / Medications
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(activePatient.demographics?.medical_history?.active_medications || activePatient.demographics?.medical_history?.current_medications)?.length ? (
                      (activePatient.demographics.medical_history.active_medications || activePatient.demographics.medical_history.current_medications).map((m: string, idx: number) => (
                        <span key={idx} className="audit-pill" style={{ background: '#eff6ff', color: '#1e40af', fontSize: '0.8rem' }}>
                          💊 {m}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No medications listed</span>
                    )}
                  </div>
                </div>

                {/* Allergies */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Known Allergies
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {activePatient.demographics?.medical_history?.allergies?.length ? (
                      activePatient.demographics.medical_history.allergies.map((a: string, idx: number) => (
                        <span key={idx} className="audit-pill" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.8rem' }}>
                          ⚠️ {a}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#16a34a' }}>No known drug allergies</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Consultation History */}
              {activePatient.demographics?.medical_history?.consultations?.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Past Consultation History ({activePatient.demographics.medical_history.consultations.length} records)
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activePatient.demographics.medical_history.consultations.map((cons: any, idx: number) => (
                      <div key={idx} style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: '0.82rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <strong>{cons.doctor_name || 'Dr. Physician'}</strong>
                          <span style={{ color: '#64748b' }}>{cons.timestamp?.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div style={{ color: '#334155' }}>{cons.clinical_notes}</div>
                        {cons.new_diagnoses?.length > 0 && (
                          <div style={{ marginTop: 4, color: '#991b1b', fontSize: '0.78rem' }}>
                            Diagnoses: {cons.new_diagnoses.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* FORM TO ADD POST-VISIT UPDATES TO ABHA DB */}
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '2px solid #cbd5e1',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                  color: '#ffffff',
                  padding: 8,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Post-Visit Updates to Commit to ABHA Database
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Document new diagnoses, prescribed medications & clinical notes to synchronize with patient's national health record.
                  </span>
                </div>
              </div>

              {/* 1. Add New Diagnoses / Conditions */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                  1. Add New Diagnosis / Clinical Condition:
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={newConditionInput}
                    onChange={(e) => setNewConditionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCondition(newConditionInput); } }}
                    placeholder="e.g. Right Distal Ureteric Calculus (4.1mm), Type 2 Diabetes, etc."
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      background: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                    onClick={() => handleAddCondition(newConditionInput)}
                  >
                    + Add
                  </button>
                </div>

                {/* Quick Diagnosis Suggestions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', alignSelf: 'center' }}>Quick Suggestions:</span>
                  {[
                    'Right Distal Ureteric Calculus (4.1mm)',
                    'Acute Ureteric Colic (ICD-10 N20.1)',
                    'Mild Right Hydronephrosis',
                    'Essential Hypertension',
                    'Acute Dyspepsia / GERD'
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      style={{
                        padding: '3px 8px',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        border: '1px solid #c7d2fe',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleAddCondition(s)}
                    >
                      + {s}
                    </button>
                  ))}
                </div>

                {/* Staged conditions */}
                {stagedConditions.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', alignSelf: 'center' }}>Ready to save:</span>
                    {stagedConditions.map((cond, idx) => (
                      <span key={idx} className="audit-pill" style={{ background: '#dcfce7', color: '#166534', gap: 5, padding: '4px 8px' }}>
                        <span>● {cond}</span>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}
                          onClick={() => handleRemoveCondition(cond)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Add New Prescribed Medications */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                  2. Add Prescribed Medication:
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={newMedInput}
                    onChange={(e) => setNewMedInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMedication(newMedInput); } }}
                    placeholder="e.g. Tab. Tamsulosin 0.4mg OD at bedtime (14 days)"
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      background: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                    onClick={() => handleAddMedication(newMedInput)}
                  >
                    + Add
                  </button>
                </div>

                {/* Quick Med Suggestions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', alignSelf: 'center' }}>Quick Suggestions:</span>
                  {[
                    'Tamsulosin 0.4mg OD at bedtime (14 days)',
                    'Paracetamol 650mg SOS for flank pain (5 days)',
                    'Ciprofloxacin 500mg BD after food (5 days)',
                    'Pantoprazole 40mg OD before breakfast (14 days)'
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      style={{
                        padding: '3px 8px',
                        background: '#eff6ff',
                        color: '#1e40af',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleAddMedication(s)}
                    >
                      + {s}
                    </button>
                  ))}
                </div>

                {/* Staged medications */}
                {stagedMedications.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', alignSelf: 'center' }}>Ready to save:</span>
                    {stagedMedications.map((med, idx) => (
                      <span key={idx} className="audit-pill" style={{ background: '#dbeafe', color: '#1e40af', gap: 5, padding: '4px 8px' }}>
                        <span>💊 {med}</span>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0 }}
                          onClick={() => handleRemoveMedication(med)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Post-Visit Clinical Consultation Notes */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                  3. Clinical Consultation Summary & Patient Advice:
                </label>
                <textarea
                  rows={3}
                  value={postVisitNotes}
                  onChange={(e) => setPostVisitNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    background: '#ffffff',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Big Save Button */}
              <button
                type="button"
                className="btn btn-success"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                  borderRadius: 12
                }}
                onClick={handleSaveDoctorHistory}
                disabled={isSavingHistory}
              >
                <Save size={18} />
                <span>{isSavingHistory ? "Committing to ABHA Registry..." : "💾 Save & Sync Updates to Patient's ABHA Database"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HL7 FHIR R4 & COMPLIANCE */}
      {activeTab === 'fhir' && (
        <div className="portal-tab-content">
          <div className="cb-card portal-card-elevated">
            <div className="cb-card-header">
              <div className="cb-card-title">
                <FileText size={20} color="#5568d7" />
                <span>ABDM HL7 FHIR R4 Document Bundle & Compliance Gate</span>
              </div>
              <span className="audit-pill" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                ABDM Milestones 1, 2, 3 Certified
              </span>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
              All teleconsultation encounters are serialised as interoperable HL7 FHIR R4 Bundles compliant with the Ayushman Bharat Digital Mission (ABDM) and verifiable under the Digital Personal Data Protection (DPDP) Act 2023.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              marginBottom: 20
            }}>
              <div className="portal-info-box">
                <span className="portal-info-label">Resource Type:</span>
                <strong className="portal-info-value">Bundle (type: document)</strong>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>Standard: HL7 FHIR R4</div>
              </div>
              <div className="portal-info-box">
                <span className="portal-info-label">Encounter ID:</span>
                <strong className="portal-info-value">#ENC-9481</strong>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>PHC Hassan Tele-Triage</div>
              </div>
              <div className="portal-info-box">
                <span className="portal-info-label">Physician Signature:</span>
                <strong className="portal-info-value" style={{ color: isSigned ? '#166534' : '#b45309' }}>
                  {isSigned ? "NMC-SIG-SHA256:7955..." : "Pending Physician Sign-Off"}
                </strong>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>HMAC Tamper-Proof</div>
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 8, color: '#0f172a' }}>
                Included FHIR R4 Resources:
              </div>
              <ul style={{ paddingLeft: 20, fontSize: '0.85rem', color: '#334155', lineHeight: 1.7 }}>
                <li><code>Patient/{activePatient.patient_id}</code> (ABHA: {activePatient.abha_address})</li>
                <li><code>Practitioner/dr_ananya_sharma</code> (NMC Reg: #KA-581920)</li>
                <li><code>Encounter/enc_9481</code> (Status: Finished / In-Progress)</li>
                <li><code>Condition/cond_calculus</code> (ICD-10: N20.1 Calculus of ureter)</li>
                <li><code>MedicationRequest/med_tamsulosin</code> (Tamsulosin 0.4mg OD bedtime)</li>
                <li><code>Provenance</code> (HMAC-SHA256 Cryptographic Audit Trail)</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onExportFHIR}
              >
                <Download size={16} />
                <span>Download HL7 FHIR R4 JSON Bundle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Patient via ABHA Modal */}
      <LinkPatientModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onPatientLinked={handlePatientLinked}
      />
    </div>
  );
};

