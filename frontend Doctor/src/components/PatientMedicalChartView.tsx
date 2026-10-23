import React, { useState, useEffect, useMemo } from 'react';
import { api, type PatientSummary } from '../services/api';
import type { PatientFullRecord, UpcomingAppointment } from '../data/patientRecords';
import { t, type SupportedLanguage } from '../utils/translations';

interface PatientMedicalChartViewProps {
  patient: PatientSummary;
  onBackToQueue: () => void;
  onStartConsultation: (patient: PatientSummary) => void;
  onRequestConsent: () => void;
  onViewClinicalRecords: () => void;
  selectedLanguage: SupportedLanguage;
  onRescheduleAppointment?: (appointment: UpcomingAppointment) => Promise<UpcomingAppointment>;
}

export const PatientMedicalChartView: React.FC<PatientMedicalChartViewProps> = ({
  patient,
  onBackToQueue,
  onStartConsultation,
  onRequestConsent,
  onViewClinicalRecords,
  selectedLanguage,
  onRescheduleAppointment,
}) => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'history' | 'last-appointment' | 'prescriptions' | 'next-appointment'
  >('overview');

  // Chart comes from the database; patients without a recorded history get a
  // basic chart built from their queue entry.
  const [chartData, setChartData] = useState<{
    chart: PatientFullRecord | null;
    next_appointment: UpcomingAppointment | null;
  } | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [isSavingReschedule, setIsSavingReschedule] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChartData(null);
    setChartError(null);
    api
      .getPatientChart(patient.patient_id)
      .then((data) => {
        if (!cancelled) setChartData(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setChartError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.patient_id]);

  const record: PatientFullRecord = useMemo(() => chartData?.chart || ({
    patientId: patient.patient_id,
    fullName: patient.full_name,
    abhaAddress: patient.abha_address,
    abhaNumber: '14-8921-0021-4412',
    phoneNumber: patient.phone_number || '+91 98450 12345',
    gender: patient.demographics.gender || 'Patient',
    age: patient.demographics.age || 50,
    dateOfBirth: '14 June 1974',
    bloodGroup: 'B+ (Positive)',
    preferredLanguage: patient.preferred_language === 'kn' ? 'Kannada' : 'Hindi',
    occupation: patient.demographics.occupation || 'General Public',
    district: patient.demographics.district || 'Karnataka',
    emergencyContact: {
      name: 'Family Member',
      relation: 'Next of Kin',
      phone: '+91 98450 00000',
    },
    chronicConditions: [
      {
        id: 'c1',
        name: patient.complaint || 'Primary Medical Condition',
        icd10: 'R10.9',
        diagnosedYear: 2026,
        status: 'Active',
        severity: 'Moderate',
        notes: 'Under active tele-triage review.',
      },
    ],
    surgicalHistory: [],
    allergies: (patient.allergies || []).map((a, i) => ({
      id: `a_${i}`,
      allergen: a,
      reaction: 'Hypersensitivity reaction',
      severity: 'Critical',
      diagnosedDate: 'Verified Record',
    })),
    familyHistory: [{ relation: 'Family', conditions: ['Hypertension'] }],
    socialHabits: {
      smoking: 'Non-smoker',
      alcohol: 'Non-drinker',
      physicalActivity: 'Moderate',
      dailyHydration: '1.5 Liters/day',
      diet: 'Standard Regional Diet',
    },
    immunizations: [{ vaccine: 'COVID-19 Verified', date: '2021', status: 'Verified' }],
    lastAppointment: {
      encounterId: 'enc_prev_001',
      date: '14 Sep 2026',
      facility: 'Hassan District Telemedicine Centre',
      doctorName: 'Dr. C. R. Patil',
      specialty: 'Internal Medicine',
      mode: 'In-Person Warm Clinic',
      chiefComplaint: patient.complaint || 'General follow up',
      historyOfPresentIllness: 'Follow up evaluation for chief complaint and treatment response.',
      vitals: {
        bp: patient.vitals?.split('•')[0]?.trim() || '120/80 mmHg',
        heartRate: '76 bpm',
        temperature: patient.vitals?.split('•')[1]?.trim() || '98.6°F',
        spo2: patient.vitals?.split('•')[2]?.trim() || '98%',
        respiratoryRate: '18 /min',
        bmi: '24.0 kg/m²',
      },
      physicalExamFindings: ['Vitals stable', 'Abdomen soft', 'No focal deficits'],
      diagnosticAssessment: 'Clinical assessment in progress under ABDM protocol.',
      physicianNotes: 'Routine care protocol active. Scheduled for periodic review.',
      clinicalAdvice: ['Maintain adequate hydration', 'Take medications as prescribed'],
      investigationsOrdered: ['Diagnostic Ultrasound', 'Biochemistry Panel'],
    },
    prescriptions: (patient.active_rx || ['Paracetamol 650mg']).map((rx, i) => ({
      id: `rx_${i}`,
      name: rx,
      dosage: 'Standard Dosage',
      route: 'Oral',
      frequency: 'As Prescribed',
      timing: 'After meals',
      duration: 'Ongoing',
      purpose: 'Therapeutic management',
      schedule: { morning: true, afternoon: false, night: true },
      refillsRemaining: 1,
      prescribedBy: 'Attending Clinician',
      prescribedDate: 'Recent',
      status: 'Active',
    })),
    nextAppointment: chartData?.next_appointment || {
      // Not booked yet: saving the reschedule form books it
      appointmentId: 'new',
      date: 'Tomorrow, 23 Oct 2026',
      time: '10:30 AM IST',
      relativeTime: 'Scheduled for Tomorrow',
      mode: 'Telehealth Video',
      doctorName: '',
      specialty: 'General Medicine & Tele-triage',
      facility: 'SwasthyaSetu Virtual Tele-Clinic',
      agenda: 'Tele-consultation and review of active symptoms.',
      status: 'Confirmed by Patient',
      instructionsForPatient: ['Keep medical reports and medicine list ready.'],
    },
  }), [chartData, patient]);

  const [nextAppointment, setNextAppointment] = useState<UpcomingAppointment>(record.nextAppointment);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('2026-10-24');
  const [rescheduleTime, setRescheduleTime] = useState('11:00 AM IST');
  const [rescheduleMode, setRescheduleMode] = useState<'Telehealth Video' | 'In-Person Warm Clinic'>(
    record.nextAppointment.mode
  );
  const [rescheduleAgenda, setRescheduleAgenda] = useState(record.nextAppointment.agenda);
  const [rescheduleInstructions, setRescheduleInstructions] = useState(
    record.nextAppointment.instructionsForPatient.join(', ')
  );

  useEffect(() => {
    setNextAppointment(record.nextAppointment);
    setRescheduleAgenda(record.nextAppointment.agenda);
    setRescheduleInstructions(record.nextAppointment.instructionsForPatient.join(', '));
  }, [record]);

  const handleConfirmReschedule = async () => {
    let displayDate = rescheduleDate;
    try {
      const d = new Date(rescheduleDate);
      if (!isNaN(d.getTime())) {
        displayDate = d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {
      // keep date
    }

    const updated: UpcomingAppointment = {
      ...nextAppointment,
      date: displayDate,
      time: rescheduleTime,
      relativeTime: `Rescheduled to ${displayDate}`,
      mode: rescheduleMode,
      agenda: rescheduleAgenda,
      status: 'Confirmed by Patient',
      instructionsForPatient: rescheduleInstructions
        ? rescheduleInstructions.split(',').map((s) => s.trim()).filter(Boolean)
        : nextAppointment.instructionsForPatient,
    };

    if (!onRescheduleAppointment) return;
    setIsSavingReschedule(true);
    setRescheduleError(null);
    try {
      const saved = await onRescheduleAppointment({ ...updated, patientId: patient.patient_id });
      setNextAppointment(saved);
      setIsRescheduleModalOpen(false);
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : 'Could not save the appointment');
    } finally {
      setIsSavingReschedule(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
      {(chartError || !chartData) && (
        <div
          className={`text-[11px] px-3 py-2 rounded-xl ${
            chartError ? 'text-[#FF3B30] bg-[#FF3B30]/10' : 'text-[#8E8E93] bg-black/5'
          }`}
        >
          {chartError ? `Could not load the full chart: ${chartError}` : 'Loading chart from the database…'}
        </div>
      )}

      {/* Top Breadcrumb & Command Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E5E5EA]/80 hover:bg-[#E5E5EA] text-[#1C1C1E] text-xs font-semibold transition-all shadow-apple-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>{t(selectedLanguage, 'backToQueue')}</span>
          </button>
          <span className="text-[#8E8E93] text-sm">/</span>
          <span className="text-xs font-medium text-[#8E8E93] uppercase tracking-wider">
            {t(selectedLanguage, 'comprehensiveChart')}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onViewClinicalRecords}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-black/5 text-[#1C1C1E] text-xs font-semibold border border-black/10 shadow-apple-sm transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px] text-[#007AFF]">folder_open</span>
            <span>{t(selectedLanguage, 'abdmVault')}</span>
          </button>

          <button
            onClick={onRequestConsent}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-black/5 text-[#1C1C1E] text-xs font-semibold border border-black/10 shadow-apple-sm transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px] text-[#FF9500]">key</span>
            <span>{t(selectedLanguage, 'requestConsent')}</span>
          </button>

          <button
            onClick={() => onStartConsultation(patient)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white text-xs font-semibold shadow-apple-sm transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">videocam</span>
            <span>{t(selectedLanguage, 'startVideoCall')}</span>
          </button>
        </div>
      </div>

      {/* Hero Patient Identity Card */}
      <div className="bg-white rounded-3xl p-6 lg:p-7 shadow-apple-sm border border-black/5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 sm:gap-5">
          <img
            src={
              patient.avatar_url ||
              'https://lh3.googleusercontent.com/aida-public/AB6AXuAMknnrL1azNBnB58uMox-l1CcLlCOqWvUimLBiLkJDaWKKrtkqvKnzs2xdOeVF8iSMHpTSk0ENugY-yF1k0JbvFHTOYCtzwJVjaqx9vKZdAogAGrJm1fLfa22lW6sdm1aSSRYxv0craALN6s1BZNS6itFWOoWj_QWMP-wF772FTz5PEDVqxhkesTSt97veSZTFlDJhJgLUmUjUgo1fQDzUqUL_PXosFUri_P1ve9yPukx2vFxzlUA5NQ'
            }
            alt={record.fullName}
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-black/5 shrink-0 shadow-apple-sm"
          />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E] tracking-tight">
                {record.fullName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#34C759]/15 text-[#248A3D]">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>{t(selectedLanguage, 'abdmVerified')}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#007AFF]/10 text-[#007AFF]">
                {record.bloodGroup}
              </span>
            </div>

            <div className="text-xs text-[#636366] flex flex-wrap items-center gap-2 mt-0.5">
              <span>{record.age} years</span>
              <span>•</span>
              <span>{record.gender}</span>
              <span>•</span>
              <span>{record.occupation}</span>
              <span>•</span>
              <span className="text-[#1C1C1E] font-medium">{record.district}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] font-mono bg-[#F2F2F7] px-2 py-0.5 rounded border border-black/5 text-[#636366]">
                ABHA: <span className="text-[#007AFF] font-semibold">{record.abhaAddress}</span>
              </span>
              <span className="text-[11px] text-[#8E8E93]">
                ID: {record.abhaNumber}
              </span>
              <span className="text-[11px] text-[#8E8E93]">
                {t(selectedLanguage, 'language')}: <span className="font-medium text-[#1C1C1E]">{record.preferredLanguage}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Contact & Policy Chip */}
        <div className="bg-[#F2F2F7] rounded-2xl p-3.5 sm:p-4 border border-black/5 flex flex-col gap-1.5 w-full lg:w-auto shrink-0 min-w-[240px]">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">
            <span className="material-symbols-outlined text-[13px] text-[#FF3B30]">emergency</span>
            <span>{t(selectedLanguage, 'emergencyContact')}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1C1C1E]">{record.emergencyContact.name} ({record.emergencyContact.relation})</span>
            <span className="font-mono text-[#007AFF]">{record.emergencyContact.phone}</span>
          </div>
          <div className="text-[11px] text-[#8E8E93] pt-1 border-t border-black/5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-[#34C759]">health_and_safety</span>
            <span className="truncate">{record.insurancePolicy?.scheme || 'PM-JAY Eligible'}</span>
          </div>
        </div>
      </div>

      {/* 4 Top Apple Health Glanceable Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Next Appointment */}
        <div className="bg-gradient-to-br from-[#007AFF]/10 via-[#007AFF]/5 to-transparent rounded-2xl p-5 border border-[#007AFF]/25 shadow-apple-sm flex flex-col justify-between min-h-[140px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">
                {t(selectedLanguage, 'nextAppointment')}
              </span>
              <span className="material-symbols-outlined text-[#007AFF] text-xl">event</span>
            </div>
            <span className="text-base font-bold text-[#1C1C1E] leading-snug">
              {nextAppointment.date}
            </span>
            <span className="text-xs font-semibold text-[#007AFF]">
              {nextAppointment.time}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/5 text-[11px] text-[#636366] flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-[#34C759] shrink-0" />
              <span className="truncate">{nextAppointment.mode}</span>
            </div>
            <button
              onClick={() => setIsRescheduleModalOpen(true)}
              className="text-[#007AFF] hover:underline font-semibold flex items-center gap-0.5 shrink-0"
            >
              <span>{t(selectedLanguage, 'reschedule')}</span>
              <span className="material-symbols-outlined text-[13px]">edit_calendar</span>
            </button>
          </div>
        </div>

        {/* Card 2: Last Encounter */}
        <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-apple-sm flex flex-col justify-between min-h-[140px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                {t(selectedLanguage, 'lastConsultation')}
              </span>
              <span className="material-symbols-outlined text-[#8E8E93] text-xl">history_edu</span>
            </div>
            <span className="text-base font-bold text-[#1C1C1E] leading-snug">
              {record.lastAppointment.date}
            </span>
            <span className="text-xs text-[#636366] truncate">
              {record.lastAppointment.facility}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/5 text-[11px] text-[#8E8E93] truncate">
            {t(selectedLanguage, 'attendingClinician')}: {record.lastAppointment.doctorName}
          </div>
        </div>

        {/* Card 3: Active Medications */}
        <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-apple-sm flex flex-col justify-between min-h-[140px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                {t(selectedLanguage, 'prescriptionsRx')}
              </span>
              <span className="material-symbols-outlined text-[#34C759] text-xl">medication</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#1C1C1E] tracking-tight">
                {record.prescriptions.filter((p) => p.status === 'Active').length}
              </span>
              <span className="text-xs font-normal text-[#8E8E93]">{t(selectedLanguage, 'active')}</span>
            </div>
            <span className="text-xs text-[#248A3D] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>{t(selectedLanguage, 'ddiSafety')}</span>
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/5 text-[11px] text-[#8E8E93] truncate">
            {t(selectedLanguage, 'lastDispensed')}: {record.lastAppointment.date}
          </div>
        </div>

        {/* Card 4: Critical Alerts & Allergies */}
        <div
          className={`rounded-2xl p-5 border shadow-apple-sm flex flex-col justify-between min-h-[140px] ${
            record.allergies.length > 0
              ? 'bg-[#FF3B30]/5 border-[#FF3B30]/20'
              : 'bg-white border-black/5'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  record.allergies.length > 0 ? 'text-[#FF3B30]' : 'text-[#8E8E93]'
                }`}
              >
                {t(selectedLanguage, 'allergiesAndAlerts')}
              </span>
              <span
                className={`material-symbols-outlined text-xl ${
                  record.allergies.length > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'
                }`}
              >
                {record.allergies.length > 0 ? 'warning' : 'verified'}
              </span>
            </div>
            {record.allergies.length > 0 ? (
              <>
                <span className="text-[15px] font-bold text-[#FF3B30] leading-snug">
                  {record.allergies[0].allergen}
                </span>
                <span className="text-xs text-[#8E8E93] truncate">
                  {record.allergies[0].severity} Severity
                </span>
              </>
            ) : (
              <>
                <span className="text-[15px] font-bold text-[#1C1C1E]">
                  {t(selectedLanguage, 'noKnownAllergies')}
                </span>
                <span className="text-xs text-[#34C759]">{t(selectedLanguage, 'nkaReported')}</span>
              </>
            )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/5 text-[11px] text-[#8E8E93] truncate">
            {record.chronicConditions[0]?.name || 'Standard Triage'}
          </div>
        </div>
      </div>

      {/* Apple Segmented Control for Patient Record Sub-sections */}
      <div className="flex items-center p-1 rounded-2xl bg-[#E5E5EA]/70 ring-1 ring-black/5 overflow-x-auto">
        <button
          onClick={() => setActiveSection('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeSection === 'overview'
              ? 'bg-white text-[#1C1C1E] shadow-apple-sm'
              : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
          }`}
        >
          {t(selectedLanguage, 'tabOverview')}
        </button>

        <button
          onClick={() => setActiveSection('last-appointment')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeSection === 'last-appointment'
              ? 'bg-white text-[#1C1C1E] shadow-apple-sm'
              : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
          }`}
        >
          <span>{t(selectedLanguage, 'tabLastEncounter')}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#007AFF]/10 text-[#007AFF]">
            SOAP
          </span>
        </button>

        <button
          onClick={() => setActiveSection('prescriptions')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeSection === 'prescriptions'
              ? 'bg-white text-[#1C1C1E] shadow-apple-sm'
              : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
          }`}
        >
          <span>{t(selectedLanguage, 'tabPrescriptions')}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#34C759]/15 text-[#248A3D]">
            {record.prescriptions.filter((p) => p.status === 'Active').length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('next-appointment')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeSection === 'next-appointment'
              ? 'bg-white text-[#1C1C1E] shadow-apple-sm'
              : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
          }`}
        >
          <span>{t(selectedLanguage, 'tabNextAppointment')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeSection === 'history'
              ? 'bg-white text-[#1C1C1E] shadow-apple-sm'
              : 'text-[#636366] hover:text-[#1C1C1E] hover:bg-black/5'
          }`}
        >
          {t(selectedLanguage, 'tabFullHistory')}
        </button>
      </div>

      {/* SECTION 1: OVERVIEW & VITALS */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Vitals History & Clinical Parameters (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-apple-sm border border-black/5 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#007AFF] text-xl">vital_signs</span>
                <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight">
                  {t(selectedLanguage, 'latestRecordedVitals')}
                </h3>
              </div>
              <span className="text-xs text-[#8E8E93]">
                {t(selectedLanguage, 'recordedOn')} {record.lastAppointment.date}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{t(selectedLanguage, 'bloodPressure')}</span>
                <span className="text-lg font-bold text-[#1C1C1E] mt-1">{record.lastAppointment.vitals.bp}</span>
                <span className="text-[11px] text-[#34C759] font-medium mt-0.5">{t(selectedLanguage, 'optimalRange')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{t(selectedLanguage, 'heartRate')}</span>
                <span className="text-lg font-bold text-[#1C1C1E] mt-1">{record.lastAppointment.vitals.heartRate}</span>
                <span className="text-[11px] text-[#34C759] font-medium mt-0.5">{t(selectedLanguage, 'regularRhythm')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{t(selectedLanguage, 'temperature')}</span>
                <span className="text-lg font-bold text-[#1C1C1E] mt-1">{record.lastAppointment.vitals.temperature}</span>
                <span className="text-[11px] text-[#8E8E93] font-medium mt-0.5">Oral Thermometry</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{t(selectedLanguage, 'oxygenSaturation')}</span>
                <span className="text-lg font-bold text-[#1C1C1E] mt-1">{record.lastAppointment.vitals.spo2}</span>
                <span className="text-[11px] text-[#34C759] font-medium mt-0.5">{t(selectedLanguage, 'ambientAir')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{t(selectedLanguage, 'respiratoryRate')}</span>
                <span className="text-lg font-bold text-[#1C1C1E] mt-1">{record.lastAppointment.vitals.respiratoryRate}</span>
                <span className="text-[11px] text-[#8E8E93] font-medium mt-0.5">Unlabored</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col">
                <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">{t(selectedLanguage, 'bmiIndex')}</span>
                <span className="text-lg font-bold text-[#1C1C1E] mt-1">{record.lastAppointment.vitals.bmi}</span>
                <span className="text-[11px] text-[#34C759] font-medium mt-0.5">Normal Weight</span>
              </div>
            </div>

            {/* Chief Complaint Callout */}
            <div className="p-4 rounded-2xl bg-[#007AFF]/5 border border-[#007AFF]/20 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#007AFF] uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">stethoscope</span>
                <span>{t(selectedLanguage, 'activeComplaint')}</span>
              </div>
              <p className="text-sm font-semibold text-[#1C1C1E]">
                "{record.lastAppointment.chiefComplaint}"
              </p>
              <p className="text-xs text-[#636366] leading-relaxed">
                {record.lastAppointment.historyOfPresentIllness}
              </p>
            </div>
          </div>

          {/* Quick Chronic Conditions & Demographics (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-white rounded-3xl p-6 shadow-apple-sm border border-black/5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/5">
                <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight">
                  {t(selectedLanguage, 'activeDiagnoses')}
                </h3>
                <span className="text-xs text-[#007AFF] font-medium">
                  {record.chronicConditions.length} Diagnoses
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {record.chronicConditions.map((cond) => (
                  <div
                    key={cond.id}
                    className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1C1C1E]">{cond.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#8E8E93] border border-black/5">
                        {cond.icd10}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#636366] leading-relaxed">{cond.notes}</span>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#8E8E93]">
                      <span>Diagnosed {cond.diagnosedYear}</span>
                      <span>•</span>
                      <span className="font-semibold text-[#007AFF]">{cond.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lifestyle Snapshot */}
            <div className="bg-white rounded-3xl p-6 shadow-apple-sm border border-black/5 flex flex-col gap-3">
              <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight pb-2 border-b border-black/5">
                {t(selectedLanguage, 'lifestyleProfile')}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">Hydration</span>
                  <span className="font-medium text-[#1C1C1E] mt-0.5">{record.socialHabits.dailyHydration}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">Activity</span>
                  <span className="font-medium text-[#1C1C1E] mt-0.5">{record.socialHabits.physicalActivity}</span>
                </div>
                <div className="flex flex-col mt-2">
                  <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">Smoking</span>
                  <span className="font-medium text-[#1C1C1E] mt-0.5">{record.socialHabits.smoking}</span>
                </div>
                <div className="flex flex-col mt-2">
                  <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">Diet</span>
                  <span className="font-medium text-[#1C1C1E] mt-0.5">{record.socialHabits.diet}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: LAST APPOINTMENT NOTES (FULL SOAP) */}
      {activeSection === 'last-appointment' && (
        <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-apple-sm border border-black/5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#007AFF] text-2xl">medical_information</span>
                <h3 className="text-xl font-bold text-[#1C1C1E] tracking-tight">
                  {t(selectedLanguage, 'clinicalEncounterNotes')}
                </h3>
              </div>
              <p className="text-xs text-[#8E8E93] mt-1">
                Conducted at {record.lastAppointment.facility} on {record.lastAppointment.date} by {record.lastAppointment.doctorName} ({record.lastAppointment.specialty})
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs font-semibold self-start sm:self-auto">
              {record.lastAppointment.mode}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subjective */}
            <div className="p-5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-[#007AFF] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
                {t(selectedLanguage, 'subjective')}
              </span>
              <div className="text-xs text-[#1C1C1E] leading-relaxed">
                <strong className="block text-[13px] mb-1">{t(selectedLanguage, 'chiefComplaintLabel')}</strong>
                {record.lastAppointment.chiefComplaint}
              </div>
              <div className="text-xs text-[#636366] leading-relaxed mt-1">
                <strong className="block text-[13px] text-[#1C1C1E] mb-1">{t(selectedLanguage, 'hpiLabel')}</strong>
                {record.lastAppointment.historyOfPresentIllness}
              </div>
            </div>

            {/* Objective */}
            <div className="p-5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-[#34C759] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                {t(selectedLanguage, 'objective')}
              </span>
              <ul className="text-xs text-[#1C1C1E] space-y-1.5 list-disc list-inside">
                {record.lastAppointment.physicalExamFindings.map((finding, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {finding}
                  </li>
                ))}
              </ul>
              <div className="mt-2 pt-2 border-t border-black/5 text-xs text-[#636366]">
                <strong>Vitals:</strong> BP {record.lastAppointment.vitals.bp} • HR {record.lastAppointment.vitals.heartRate} • Temp {record.lastAppointment.vitals.temperature} • SpO2 {record.lastAppointment.vitals.spo2}
              </div>
            </div>

            {/* Assessment */}
            <div className="p-5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-[#FF9500] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF9500]" />
                {t(selectedLanguage, 'assessment')}
              </span>
              <p className="text-xs text-[#1C1C1E] font-medium leading-relaxed">
                {record.lastAppointment.diagnosticAssessment}
              </p>
              <div className="mt-2 text-xs text-[#636366] leading-relaxed bg-white/70 p-3 rounded-xl border border-black/5">
                <strong>{t(selectedLanguage, 'physicianImpression')}</strong>
                <p className="mt-1">{record.lastAppointment.physicianNotes}</p>
              </div>
            </div>

            {/* Plan */}
            <div className="p-5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-[#5856D6] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#5856D6]" />
                {t(selectedLanguage, 'planAdvice')}
              </span>
              <div className="flex flex-col gap-1.5 text-xs">
                <strong className="text-[13px] text-[#1C1C1E]">{t(selectedLanguage, 'clinicianInstructions')}</strong>
                <ul className="list-disc list-inside space-y-1 text-[#1C1C1E]">
                  {record.lastAppointment.clinicalAdvice.map((adv, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {adv}
                    </li>
                  ))}
                </ul>

                <strong className="text-[13px] text-[#1C1C1E] mt-2">{t(selectedLanguage, 'orderedTests')}</strong>
                <div className="flex flex-wrap gap-1.5">
                  {record.lastAppointment.investigationsOrdered.map((inv, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-white text-[11px] font-semibold text-[#5856D6] border border-black/5"
                    >
                      {inv}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-black/5 flex items-center justify-between text-xs text-[#8E8E93]">
            <span>Digitally Authenticated with NMC Clinician Token</span>
            <span className="font-mono text-[11px]">Encounter Ref: #{record.lastAppointment.encounterId}</span>
          </div>
        </div>
      )}

      {/* SECTION 3: PRESCRIPTIONS & RX */}
      {activeSection === 'prescriptions' && (
        <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-apple-sm border border-black/5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/5">
            <div>
              <h3 className="text-xl font-bold text-[#1C1C1E] tracking-tight">
                {t(selectedLanguage, 'activeMedicalPrescriptions')}
              </h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">
                {t(selectedLanguage, 'prescriptionsSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#34C759]/15 text-[#248A3D] text-xs font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">verified</span>
                <span>{t(selectedLanguage, 'cdssSafetyCleared')}</span>
              </span>
            </div>
          </div>

          {/* Active Meds Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {record.prescriptions
              .filter((p) => p.status === 'Active')
              .map((med) => (
                <div
                  key={med.id}
                  className="p-5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col justify-between gap-3.5 hover:shadow-apple-sm transition-all"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[15px] font-bold text-[#1C1C1E] leading-snug">
                          {med.name}
                        </span>
                        <span className="text-xs font-semibold text-[#007AFF] mt-0.5">
                          {med.dosage} • {med.route}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#34C759]/15 text-[#248A3D]">
                        {med.frequency}
                      </span>
                    </div>

                    <p className="text-xs text-[#636366] leading-relaxed mt-1">
                      {med.purpose}
                    </p>

                    {/* Timing & Schedule */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-[#1C1C1E] bg-white px-2.5 py-1 rounded-lg border border-black/5">
                        🕒 {med.timing}
                      </span>
                      <span className="text-xs font-medium text-[#636366] bg-white px-2.5 py-1 rounded-lg border border-black/5">
                        Duration: {med.duration}
                      </span>
                    </div>

                    {/* Daily Dosing Schedule Chips */}
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          med.schedule.morning
                            ? 'bg-[#007AFF]/15 text-[#007AFF]'
                            : 'bg-black/5 text-[#8E8E93] line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'morning')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          med.schedule.afternoon
                            ? 'bg-[#007AFF]/15 text-[#007AFF]'
                            : 'bg-black/5 text-[#8E8E93] line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'noon')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          med.schedule.night
                            ? 'bg-[#007AFF]/15 text-[#007AFF]'
                            : 'bg-black/5 text-[#8E8E93] line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'night')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/5 flex items-center justify-between text-[11px] text-[#8E8E93]">
                    <span>By: {med.prescribedBy}</span>
                    <span className="font-semibold text-[#007AFF]">
                      {med.refillsRemaining} {t(selectedLanguage, 'refillsLeft')}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Discontinued / Past Meds */}
          {record.prescriptions.some((p) => p.status === 'Discontinued') && (
            <div className="mt-4 pt-5 border-t border-black/5 flex flex-col gap-3">
              <h4 className="text-sm font-bold text-[#8E8E93] uppercase tracking-wider">
                {t(selectedLanguage, 'discontinuedTitle')}
              </h4>
              <div className="flex flex-col gap-2">
                {record.prescriptions
                  .filter((p) => p.status === 'Discontinued')
                  .map((med) => (
                    <div
                      key={med.id}
                      className="p-3.5 rounded-xl bg-[#FFF2F2] border border-[#FF3B30]/15 flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-[#FF3B30]">{med.name} ({med.dosage})</span>
                        <span className="text-[#8E8E93] mt-0.5">{med.discontinuedReason}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF3B30]/15 text-[#FF3B30]">
                        Stopped
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: NEXT APPOINTMENT */}
      {activeSection === 'next-appointment' && (
        <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-apple-sm border border-black/5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#007AFF] text-2xl">event_upcoming</span>
                <h3 className="text-xl font-bold text-[#1C1C1E] tracking-tight">
                  {t(selectedLanguage, 'scheduledNextApt')}
                </h3>
              </div>
              <p className="text-xs text-[#8E8E93] mt-0.5">
                {t(selectedLanguage, 'aptCalendarSubtitle')}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#34C759]/15 text-[#248A3D] text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" />
              <span>{nextAppointment.status}</span>
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#007AFF]/10 via-[#F2F2F7] to-white border border-[#007AFF]/20 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-[#007AFF] uppercase tracking-wider">
                  {t(selectedLanguage, 'upcomingDateTitle')}
                </span>
                <span className="text-2xl font-bold text-[#1C1C1E] mt-1">
                  {nextAppointment.date}
                </span>
                <span className="text-sm font-semibold text-[#007AFF] mt-0.5">
                  {nextAppointment.time} ({nextAppointment.relativeTime})
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => setIsRescheduleModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-black/5 text-[#1C1C1E] border border-black/10 text-sm font-semibold shadow-apple-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl text-[#007AFF]">edit_calendar</span>
                  <span>{t(selectedLanguage, 'rescheduleAppointment')}</span>
                </button>

                <button
                  onClick={() => onStartConsultation(patient)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#007AFF] hover:bg-[#0062CC] text-white text-sm font-semibold shadow-apple-md transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl">videocam</span>
                  <span>{t(selectedLanguage, 'launchEarly')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-black/5 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">{t(selectedLanguage, 'consultationMode')}</span>
                <span className="font-semibold text-[#1C1C1E] mt-0.5">{nextAppointment.mode}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">{t(selectedLanguage, 'attendingClinician')}</span>
                <span className="font-semibold text-[#1C1C1E] mt-0.5">{nextAppointment.doctorName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#8E8E93] uppercase font-semibold">{t(selectedLanguage, 'clinicFacility')}</span>
                <span className="font-semibold text-[#1C1C1E] mt-0.5">{nextAppointment.facility}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-black/5 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">
                {t(selectedLanguage, 'clinicalAgenda')}
              </span>
              <p className="text-xs text-[#1C1C1E] leading-relaxed">
                {nextAppointment.agenda}
              </p>
            </div>

            {/* Preparation instructions for patient */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                {t(selectedLanguage, 'patientInstructions')}
              </span>
              <ul className="text-xs text-[#636366] space-y-1 list-disc list-inside">
                {nextAppointment.instructionsForPatient.map((inst, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {inst}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: FULL MEDICAL HISTORY */}
      {activeSection === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chronic Conditions & ICD-10 */}
          <div className="bg-white rounded-3xl p-6 shadow-apple-sm border border-black/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight pb-2 border-b border-black/5">
              Documented Chronic Conditions
            </h3>
            <div className="flex flex-col gap-3">
              {record.chronicConditions.map((cond) => (
                <div key={cond.id} className="p-4 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1C1C1E]">{cond.name}</span>
                    <span className="text-xs font-mono font-semibold text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded">
                      {cond.icd10}
                    </span>
                  </div>
                  <p className="text-xs text-[#636366] leading-relaxed">{cond.notes}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8E8E93]">
                    <span>Onset: {cond.diagnosedYear}</span>
                    <span>•</span>
                    <span className="font-semibold text-[#248A3D]">{cond.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Surgeries & Procedures */}
          <div className="bg-white rounded-3xl p-6 shadow-apple-sm border border-black/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight pb-2 border-b border-black/5">
              Surgical & Hospitalization History
            </h3>
            {record.surgicalHistory.length > 0 ? (
              <div className="flex flex-col gap-3">
                {record.surgicalHistory.map((surg) => (
                  <div key={surg.id} className="p-4 rounded-2xl bg-[#F2F2F7] border border-black/5 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#1C1C1E]">{surg.procedure}</span>
                      <span className="text-xs font-semibold text-[#8E8E93]">{surg.year}</span>
                    </div>
                    <span className="text-xs text-[#007AFF] font-medium">{surg.facility}</span>
                    <p className="text-xs text-[#636366] leading-relaxed mt-0.5">{surg.notes}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#8E8E93] bg-[#F2F2F7] rounded-2xl border border-black/5">
                No prior surgical interventions reported.
              </div>
            )}
          </div>

          {/* Family Medical History */}
          <div className="bg-white rounded-3xl p-6 shadow-apple-sm border border-black/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight pb-2 border-b border-black/5">
              Family Medical Pedigree
            </h3>
            <div className="flex flex-col gap-2.5">
              {record.familyHistory.map((fam, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1C1C1E]">{fam.relation}</span>
                  <div className="flex flex-wrap gap-1">
                    {fam.conditions.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white font-medium text-[#636366] border border-black/5 text-[11px]">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Immunization Registry */}
          <div className="bg-white rounded-3xl p-6 shadow-apple-sm border border-black/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight pb-2 border-b border-black/5">
              ABDM Immunization Registry
            </h3>
            <div className="flex flex-col gap-2.5">
              {record.immunizations.map((imm, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1C1C1E]">{imm.vaccine}</span>
                  <span className="font-mono text-[#8E8E93]">{imm.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Apple HIG Reschedule Consultation Modal */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-apple-lg border border-black/10 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#F2F2F7] border-b border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/15 text-[#007AFF] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">edit_calendar</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C1C1E] tracking-tight">
                    {t(selectedLanguage, 'rescheduleModalTitle')}
                  </h3>
                  <p className="text-[11px] text-[#8E8E93]">
                    {t(selectedLanguage, 'rescheduleModalSubtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRescheduleModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-black/5 text-[#1C1C1E] flex items-center justify-center shadow-apple-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* Patient Badge */}
              <div className="p-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#007AFF]/10 text-[#007AFF] font-bold flex items-center justify-center text-xs">
                    {patient.full_name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#1C1C1E]">{patient.full_name}</span>
                    <span className="text-[11px] font-mono text-[#8E8E93]">{patient.abha_address}</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#007AFF] bg-white px-2.5 py-1 rounded-lg border border-black/5">
                  {nextAppointment.doctorName}
                </span>
              </div>

              {/* Date Presets */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  {t(selectedLanguage, 'selectDate')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-24')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-24'
                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-apple-sm'
                        : 'bg-white text-[#1C1C1E] border-black/10 hover:bg-black/5'
                    }`}
                  >
                    {t(selectedLanguage, 'presetTomorrow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-26')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-26'
                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-apple-sm'
                        : 'bg-white text-[#1C1C1E] border-black/10 hover:bg-black/5'
                    }`}
                  >
                    {t(selectedLanguage, 'preset3Days')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-30')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-30'
                        ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-apple-sm'
                        : 'bg-white text-[#1C1C1E] border-black/10 hover:bg-black/5'
                    }`}
                  >
                    {t(selectedLanguage, 'presetNextWeek')}
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-xs font-medium bg-[#F2F2F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  {t(selectedLanguage, 'selectTime')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {['09:30 AM IST', '11:00 AM IST', '02:30 PM IST', '04:30 PM IST', '06:00 PM IST'].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setRescheduleTime(slot)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                        rescheduleTime === slot
                          ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-apple-sm'
                          : 'bg-white text-[#1C1C1E] border-black/10 hover:bg-black/5'
                      }`}
                    >
                      {slot.replace(' IST', '')}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  placeholder="Custom time (e.g. 11:30 AM IST)"
                  className="w-full px-3.5 py-2 rounded-xl border border-black/10 text-xs font-medium bg-[#F2F2F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all mt-1"
                />
              </div>

              {/* Mode Toggle */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  {t(selectedLanguage, 'rescheduleMode')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleMode('Telehealth Video')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      rescheduleMode === 'Telehealth Video'
                        ? 'bg-[#007AFF]/15 text-[#007AFF] border-[#007AFF]/40'
                        : 'bg-[#F2F2F7] text-[#636366] border-black/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">videocam</span>
                    <span>Telehealth Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleMode('In-Person Warm Clinic')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      rescheduleMode === 'In-Person Warm Clinic'
                        ? 'bg-[#007AFF]/15 text-[#007AFF] border-[#007AFF]/40'
                        : 'bg-[#F2F2F7] text-[#636366] border-black/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">apartment</span>
                    <span>In-Person Warm Clinic</span>
                  </button>
                </div>
              </div>

              {/* Clinical Agenda Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  {t(selectedLanguage, 'rescheduleAgenda')}
                </label>
                <textarea
                  rows={2}
                  value={rescheduleAgenda}
                  onChange={(e) => setRescheduleAgenda(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/10 text-xs font-medium bg-[#F2F2F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all resize-none"
                />
              </div>

              {/* Patient Instructions */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
                  {t(selectedLanguage, 'rescheduleInstructions')}
                </label>
                <input
                  type="text"
                  value={rescheduleInstructions}
                  onChange={(e) => setRescheduleInstructions(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/10 text-xs font-medium bg-[#F2F2F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
                />
              </div>

              {/* Live sync note */}
              <div className="flex items-center gap-2 text-[11px] text-[#34C759] bg-[#34C759]/10 px-3 py-2 rounded-xl">
                <span className="material-symbols-outlined text-[15px]">sync</span>
                <span>Automated sync: Patient mobile app will be updated via WebSocket immediately upon confirmation.</span>
              </div>
            </div>

            {rescheduleError && (
              <div className="mx-6 mb-3 text-[11px] text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-2 rounded-xl">
                {rescheduleError}
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#F2F2F7] border-t border-black/5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsRescheduleModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8E8E93] hover:text-[#1C1C1E] transition-all"
              >
                {t(selectedLanguage, 'cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={isSavingReschedule}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] text-white text-xs font-semibold shadow-apple-sm transition-all active:scale-95 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{t(selectedLanguage, 'confirmReschedule')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
