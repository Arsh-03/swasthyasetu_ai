import React, { useState } from 'react';
import type { Language, HealthRecord } from '../types';
import {
  FilePlus, X, Heart, AlertTriangle, Pill,
  CheckCircle2, AlertCircle, RefreshCw, Lock
} from 'lucide-react';
import { authFetch } from '../services/apiClient';

interface AddMedicalRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  patientId: string;
  onRecordAdded: (newRecord: HealthRecord) => void;
  onMedicalHistoryUpdated?: (history: any) => void;
}

export const AddMedicalRecordModal: React.FC<AddMedicalRecordModalProps> = ({
  isOpen,
  onClose,
  patientId,
  onRecordAdded,
  onMedicalHistoryUpdated
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');

  // Record State
  const [title, setTitle] = useState('');
  const [recordType, setRecordType] = useState('blood_panel');
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [findings, setFindings] = useState('');

  // History State
  const [conditions, setConditions] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState('');
  const [meds, setMeds] = useState<string[]>([]);
  const [newMed, setNewMed] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState('');
  const [bloodGroup, setBloodGroup] = useState('B+');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for the health record.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/v1/records/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          record_type: recordType,
          title: title.trim(),
          date_str: dateStr,
          summary_findings: findings.trim() || "Historical patient record added to encrypted ABDM vault.",
          raw_preview_text: `Diagnostic Record: ${title.trim()}. Findings: ${findings.trim()}`,
          file_mime_type: "application/pdf",
          file_size_bytes: 1450000
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to add record.");
      }

      const created: HealthRecord = await res.json();
      onRecordAdded(created);
      setSuccessMsg("✅ Record successfully uploaded to encrypted ABDM vault!");
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to add record to vault.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/v1/auth/patient/medical-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chronic_conditions: conditions,
          current_medications: meds,
          allergies: allergies,
          surgeries: [],
          blood_group: bloodGroup
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update medical history.");
      }

      const data = await res.json();
      if (onMedicalHistoryUpdated) {
        onMedicalHistoryUpdated(data.medical_history);
      }
      setSuccessMsg("✅ Medical history updated in ABDM profile!");
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update medical history.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="abha-modal-overlay">
      <div className="abha-modal-dialog" style={{ maxWidth: 600 }}>
        <div className="top-tricolor-bar" />

        <div className="abha-modal-header">
          <div className="abha-modal-brand">
            <div className="abha-emblem-badge" style={{ background: '#5568d7' }}>
              <FilePlus size={20} color="#ffffff" />
            </div>
            <div>
              <h3 className="abha-header-title">Add Health Record & Medical History</h3>
              <p className="abha-header-subtitle">
                Encrypted ABDM Personal Health Record Vault (DPDP Act 2023)
              </p>
            </div>
          </div>

          <button type="button" className="abha-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 24px 0', borderBottom: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'record' ? 'active' : ''}`}
            style={{ borderRadius: 0, paddingBottom: 10 }}
            onClick={() => setActiveTab('record')}
          >
            <FilePlus size={15} />
            <span>Upload Diagnostic / Lab Record</span>
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            style={{ borderRadius: 0, paddingBottom: 10 }}
            onClick={() => setActiveTab('history')}
          >
            <Heart size={15} />
            <span>Update Conditions & Meds</span>
          </button>
        </div>

        {error && (
          <div className="clinical-alert clinical-alert-danger" style={{ margin: '14px 24px 0', padding: '8px 12px', fontSize: '0.85rem' }}>
            <AlertCircle size={15} />
            <div>{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="clinical-alert clinical-alert-success" style={{ margin: '14px 24px 0', padding: '8px 12px', fontSize: '0.85rem' }}>
            <CheckCircle2 size={15} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* FORM 1: ADD RECORD */}
        {activeTab === 'record' && (
          <form onSubmit={handleAddRecord} className="abha-step-body">
            <div className="auth-input-group">
              <label className="auth-input-label">Report Title / Description:</label>
              <input
                type="text"
                className="auth-input-field"
                placeholder="e.g. Ultrasound Abdomen & Pelvis (ಉದರ ಸ್ಕ್ಯಾನ್ ವರದಿ)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="auth-input-group">
                <label className="auth-input-label">Record Type:</label>
                <select
                  className="auth-input-field"
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value)}
                >
                  <option value="ultrasound">Ultrasound / Sonography</option>
                  <option value="blood_panel">Blood & Metabolic Panel</option>
                  <option value="ecg">12-Lead Resting ECG</option>
                  <option value="prescription">Prescription / Medication Slip</option>
                  <option value="discharge_summary">Hospital Discharge Summary</option>
                  <option value="radiology">X-Ray / CT Radiology</option>
                  <option value="other">Other Clinical Document</option>
                </select>
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label">Report Date:</label>
                <input
                  type="date"
                  className="auth-input-field"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label className="auth-input-label">Key Findings / Laboratory Findings:</label>
              <textarea
                className="auth-input-field"
                style={{ height: 80, resize: 'none' }}
                placeholder="Key diagnostic summary or conclusion findings..."
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
              />
            </div>

            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={16} color="#16a34a" />
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                Document encrypted with AES-256-GCM. Locked in personal vault; accessed only via patient consent token.
              </div>
            </div>

            <div className="abha-modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ gap: 6 }}>
                {isLoading ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                <span>Encrypt & Save Record</span>
              </button>
            </div>
          </form>
        )}

        {/* FORM 2: UPDATE HISTORY */}
        {activeTab === 'history' && (
          <form onSubmit={handleUpdateHistory} className="abha-step-body">
            {/* Blood Group */}
            <div className="medhist-section">
              <span className="medhist-section-title" style={{ display: 'block', marginBottom: 8 }}>
                🩸 Blood Group:
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                  <button
                    key={bg}
                    type="button"
                    className={`medhist-chip ${bloodGroup === bg ? 'selected' : ''}`}
                    onClick={() => setBloodGroup(bg)}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditions */}
            <div className="medhist-section">
              <div className="medhist-title-row">
                <Heart size={15} color="#dc2626" />
                <span className="medhist-section-title">Chronic Conditions</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder="e.g. Type 2 Diabetes, Kidney Stone"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (newCondition.trim()) {
                      setConditions([...conditions, newCondition.trim()]);
                      setNewCondition('');
                    }
                  }}
                  style={{ minHeight: 'auto', padding: '0 12px' }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {conditions.map((c, i) => (
                  <span key={i} className="audit-pill" style={{ background: '#fee2e2', color: '#991b1b' }}>
                    {c}
                    <button
                      type="button"
                      onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', marginLeft: 4, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Current Meds */}
            <div className="medhist-section">
              <div className="medhist-title-row">
                <Pill size={15} color="#5568d7" />
                <span className="medhist-section-title">Active Medications</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder="e.g. Metformin 500mg, Paracetamol 650mg"
                  value={newMed}
                  onChange={(e) => setNewMed(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (newMed.trim()) {
                      setMeds([...meds, newMed.trim()]);
                      setNewMed('');
                    }
                  }}
                  style={{ minHeight: 'auto', padding: '0 12px' }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {meds.map((m, i) => (
                  <span key={i} className="audit-pill" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                    {m}
                    <button
                      type="button"
                      onClick={() => setMeds(meds.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', marginLeft: 4, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Allergies */}
            <div className="medhist-section">
              <div className="medhist-title-row">
                <AlertTriangle size={15} color="#d97706" />
                <span className="medhist-section-title">Known Allergies</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="auth-input-field"
                  placeholder="e.g. Penicillin, Sulfa, Dust"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (newAllergy.trim()) {
                      setAllergies([...allergies, newAllergy.trim()]);
                      setNewAllergy('');
                    }
                  }}
                  style={{ minHeight: 'auto', padding: '0 12px' }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {allergies.map((a, i) => (
                  <span key={i} className="audit-pill" style={{ background: '#fef3c7', color: '#92400e' }}>
                    {a}
                    <button
                      type="button"
                      onClick={() => setAllergies(allergies.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', marginLeft: 4, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="abha-modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ gap: 6 }}>
                {isLoading ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                <span>Save Medical History</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
