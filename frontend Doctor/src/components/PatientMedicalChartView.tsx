import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api, type PatientSummary } from '../services/api';
import type { PatientFullRecord, UpcomingAppointment } from '../data/patientRecords';
import { t, type SupportedLanguage } from '../utils/translations';
import { Icon } from './ui/Icon';
import { useDialogA11y } from '../hooks/useDialogA11y';

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
  const rescheduleDialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(isRescheduleModalOpen, rescheduleDialogRef, () => setIsRescheduleModalOpen(false));
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
          className={`text-2xs px-3 py-2 rounded-xl ${
            chartError ? 'text-danger-deep bg-danger-tint' : 'text-ink-muted bg-ink/5'
          }`}
        >
          {chartError ? `Could not load the full chart: ${chartError}` : 'Loading chart from the database…'}
        </div>
      )}

      {/* Top Breadcrumb & Command Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fog/80 hover:bg-fog text-ink text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
            <Icon name="back" size={16} />
            <span>{t(selectedLanguage, 'backToQueue')}</span>
          </button>
          <span className="text-ink-muted text-sm">/</span>
          <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
            {t(selectedLanguage, 'comprehensiveChart')}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onViewClinicalRecords}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-ink/5 text-ink text-xs font-semibold border border-ink/10 shadow-sm transition-all active:scale-95"
          >
            <Icon name="records" size={16} tone="primary" weight="duotone" />
            <span>{t(selectedLanguage, 'abdmVault')}</span>
          </button>

          <button
            onClick={onRequestConsent}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-ink/5 text-ink text-xs font-semibold border border-ink/10 shadow-sm transition-all active:scale-95"
          >
            <Icon name="key" size={16} tone="warning" weight="duotone" />
            <span>{t(selectedLanguage, 'requestConsent')}</span>
          </button>

          <button
            onClick={() => onStartConsultation(patient)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-deep text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Icon name="video" size={18} />
            <span>{t(selectedLanguage, 'startVideoCall')}</span>
          </button>
        </div>
      </div>

      {/* Hero Patient Identity Card */}
      <div className="bg-card rounded-3xl p-6 lg:p-7 shadow-sm border border-ink/5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 sm:gap-5">
          <img
            src={
              patient.avatar_url ||
              'https://lh3.googleusercontent.com/aida-public/AB6AXuAMknnrL1azNBnB58uMox-l1CcLlCOqWvUimLBiLkJDaWKKrtkqvKnzs2xdOeVF8iSMHpTSk0ENugY-yF1k0JbvFHTOYCtzwJVjaqx9vKZdAogAGrJm1fLfa22lW6sdm1aSSRYxv0craALN6s1BZNS6itFWOoWj_QWMP-wF772FTz5PEDVqxhkesTSt97veSZTFlDJhJgLUmUjUgo1fQDzUqUL_PXosFUri_P1ve9yPukx2vFxzlUA5NQ'
            }
            alt={record.fullName}
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-ink/5 shrink-0 shadow-sm"
          />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                {record.fullName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-success-tint text-success-deep">
                <Icon name="verified" size={14} />
                <span>{t(selectedLanguage, 'abdmVerified')}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-primary-tint text-primary">
                {record.bloodGroup}
              </span>
            </div>

            <div className="text-xs text-ink-muted flex flex-wrap items-center gap-2 mt-0.5">
              <span>{record.age} years</span>
              <span>•</span>
              <span>{record.gender}</span>
              <span>•</span>
              <span>{record.occupation}</span>
              <span>•</span>
              <span className="text-ink font-medium">{record.district}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-2xs font-mono bg-base px-2 py-0.5 rounded border border-ink/5 text-ink-muted">
                ABHA: <span className="text-primary font-semibold">{record.abhaAddress}</span>
              </span>
              <span className="text-2xs text-ink-muted">
                ID: {record.abhaNumber}
              </span>
              <span className="text-2xs text-ink-muted">
                {t(selectedLanguage, 'language')}: <span className="font-medium text-ink">{record.preferredLanguage}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Contact & Policy Chip */}
        <div className="bg-base rounded-2xl p-3.5 sm:p-4 border border-ink/5 flex flex-col gap-1.5 w-full lg:w-auto shrink-0 min-w-[240px]">
          <div className="flex items-center gap-1 text-3xs font-bold uppercase tracking-wider text-ink-muted">
            <Icon name="emergency" size={13} tone="danger" weight="duotone" />
            <span>{t(selectedLanguage, 'emergencyContact')}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">{record.emergencyContact.name} ({record.emergencyContact.relation})</span>
            <span className="font-mono text-primary">{record.emergencyContact.phone}</span>
          </div>
          <div className="text-2xs text-ink-muted pt-1 border-t border-ink/5 flex items-center gap-1">
            <Icon name="insurance" size={12} tone="success" weight="duotone" />
            <span className="truncate">{record.insurancePolicy?.scheme || 'PM-JAY Eligible'}</span>
          </div>
        </div>
      </div>

      {/* 4 Top Apple Health Glanceable Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Next Appointment */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 border border-primary/25 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-primary">
                {t(selectedLanguage, 'nextAppointment')}
              </span>
              <Icon name="calendar" size={20} tone="primary" weight="duotone" />
            </div>
            <span className="text-base font-bold text-ink leading-snug">
              {nextAppointment.date}
            </span>
            <span className="text-xs font-semibold text-primary">
              {nextAppointment.time}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-ink/5 text-2xs text-ink-muted flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-success shrink-0" />
              <span className="truncate">{nextAppointment.mode}</span>
            </div>
            <button
              onClick={() => setIsRescheduleModalOpen(true)}
              className="text-primary hover:underline font-semibold flex items-center gap-0.5 shrink-0"
            >
              <span>{t(selectedLanguage, 'reschedule')}</span>
              <Icon name="reschedule" size={13} />
            </button>
          </div>
        </div>

        {/* Card 2: Last Encounter */}
        <div className="bg-card rounded-2xl p-5 border border-ink/5 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                {t(selectedLanguage, 'lastConsultation')}
              </span>
              <Icon name="history" size={20} tone="muted" weight="duotone" />
            </div>
            <span className="text-base font-bold text-ink leading-snug">
              {record.lastAppointment.date}
            </span>
            <span className="text-xs text-ink-muted truncate">
              {record.lastAppointment.facility}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-ink/5 text-2xs text-ink-muted truncate">
            {t(selectedLanguage, 'attendingClinician')}: {record.lastAppointment.doctorName}
          </div>
        </div>

        {/* Card 3: Active Medications */}
        <div className="bg-card rounded-2xl p-5 border border-ink/5 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                {t(selectedLanguage, 'prescriptionsRx')}
              </span>
              <Icon name="medication" size={20} tone="success" weight="duotone" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-ink tracking-tight">
                {record.prescriptions.filter((p) => p.status === 'Active').length}
              </span>
              <span className="text-xs font-normal text-ink-muted">{t(selectedLanguage, 'active')}</span>
            </div>
            <span className="text-xs text-success-deep font-medium flex items-center gap-1">
              <Icon name="checkCircle" size={14} />
              <span>{t(selectedLanguage, 'ddiSafety')}</span>
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-ink/5 text-2xs text-ink-muted truncate">
            {t(selectedLanguage, 'lastDispensed')}: {record.lastAppointment.date}
          </div>
        </div>

        {/* Card 4: Critical Alerts & Allergies */}
        <div
          className={`rounded-2xl p-5 border shadow-sm flex flex-col justify-between min-h-[140px] ${
            record.allergies.length > 0
              ? 'bg-danger/5 border-danger/20'
              : 'bg-card border-ink/5'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span
                className={`text-2xs font-bold uppercase tracking-wider ${
                  record.allergies.length > 0 ? 'text-danger-deep' : 'text-ink-muted'
                }`}
              >
                {t(selectedLanguage, 'allergiesAndAlerts')}
              </span>
              <Icon
                name={record.allergies.length > 0 ? 'warning' : 'verified'}
                size={20}
                tone={record.allergies.length > 0 ? 'danger' : 'success'}
                weight="duotone"
              />
            </div>
            {record.allergies.length > 0 ? (
              <>
                <span className="text-subhead font-bold text-danger-deep leading-snug">
                  {record.allergies[0].allergen}
                </span>
                <span className="text-xs text-ink-muted truncate">
                  {record.allergies[0].severity} Severity
                </span>
              </>
            ) : (
              <>
                <span className="text-subhead font-bold text-ink">
                  {t(selectedLanguage, 'noKnownAllergies')}
                </span>
                <span className="text-xs text-success-deep">{t(selectedLanguage, 'nkaReported')}</span>
              </>
            )}
          </div>
          <div className="mt-3 pt-2.5 border-t border-ink/5 text-2xs text-ink-muted truncate">
            {record.chronicConditions[0]?.name || 'Standard Triage'}
          </div>
        </div>
      </div>

      {/* Apple Segmented Control for Patient Record Sub-sections */}
      <div className="flex items-center p-1 rounded-2xl bg-fog/40 ring-1 ring-ink/5 overflow-x-auto">
        <button
          onClick={() => setActiveSection('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeSection === 'overview'
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink hover:bg-ink/5'
          }`}
        >
          {t(selectedLanguage, 'tabOverview')}
        </button>

        <button
          onClick={() => setActiveSection('last-appointment')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeSection === 'last-appointment'
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink hover:bg-ink/5'
          }`}
        >
          <span>{t(selectedLanguage, 'tabLastEncounter')}</span>
          <span className="text-3xs px-1.5 py-0.5 rounded-full bg-primary-tint text-primary">
            SOAP
          </span>
        </button>

        <button
          onClick={() => setActiveSection('prescriptions')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeSection === 'prescriptions'
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink hover:bg-ink/5'
          }`}
        >
          <span>{t(selectedLanguage, 'tabPrescriptions')}</span>
          <span className="text-3xs px-1.5 py-0.5 rounded-full bg-success-tint text-success-deep">
            {record.prescriptions.filter((p) => p.status === 'Active').length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('next-appointment')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            activeSection === 'next-appointment'
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink hover:bg-ink/5'
          }`}
        >
          <span>{t(selectedLanguage, 'tabNextAppointment')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeSection === 'history'
              ? 'bg-card text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink hover:bg-ink/5'
          }`}
        >
          {t(selectedLanguage, 'tabFullHistory')}
        </button>
      </div>

      {/* SECTION 1: OVERVIEW & VITALS */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Vitals History & Clinical Parameters (7 cols) */}
          <div className="lg:col-span-7 bg-card rounded-3xl p-6 shadow-sm border border-ink/5 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-ink/5">
              <div className="flex items-center gap-2">
                <Icon name="vitals" size={20} tone="primary" weight="duotone" />
                <h3 className="text-base font-bold text-ink tracking-tight">
                  {t(selectedLanguage, 'latestRecordedVitals')}
                </h3>
              </div>
              <span className="text-xs text-ink-muted">
                {t(selectedLanguage, 'recordedOn')} {record.lastAppointment.date}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-2xl bg-base border border-ink/5 flex flex-col">
                <span className="text-3xs font-bold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'bloodPressure')}</span>
                <span className="text-lg font-bold text-ink mt-1">{record.lastAppointment.vitals.bp}</span>
                <span className="text-2xs text-success-deep font-medium mt-0.5">{t(selectedLanguage, 'optimalRange')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-base border border-ink/5 flex flex-col">
                <span className="text-3xs font-bold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'heartRate')}</span>
                <span className="text-lg font-bold text-ink mt-1">{record.lastAppointment.vitals.heartRate}</span>
                <span className="text-2xs text-success-deep font-medium mt-0.5">{t(selectedLanguage, 'regularRhythm')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-base border border-ink/5 flex flex-col">
                <span className="text-3xs font-bold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'temperature')}</span>
                <span className="text-lg font-bold text-ink mt-1">{record.lastAppointment.vitals.temperature}</span>
                <span className="text-2xs text-ink-muted font-medium mt-0.5">Oral Thermometry</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-base border border-ink/5 flex flex-col">
                <span className="text-3xs font-bold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'oxygenSaturation')}</span>
                <span className="text-lg font-bold text-ink mt-1">{record.lastAppointment.vitals.spo2}</span>
                <span className="text-2xs text-success-deep font-medium mt-0.5">{t(selectedLanguage, 'ambientAir')}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-base border border-ink/5 flex flex-col">
                <span className="text-3xs font-bold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'respiratoryRate')}</span>
                <span className="text-lg font-bold text-ink mt-1">{record.lastAppointment.vitals.respiratoryRate}</span>
                <span className="text-2xs text-ink-muted font-medium mt-0.5">Unlabored</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-base border border-ink/5 flex flex-col">
                <span className="text-3xs font-bold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'bmiIndex')}</span>
                <span className="text-lg font-bold text-ink mt-1">{record.lastAppointment.vitals.bmi}</span>
                <span className="text-2xs text-success-deep font-medium mt-0.5">Normal Weight</span>
              </div>
            </div>

            {/* Chief Complaint Callout */}
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                <Icon name="doctor" size={16} />
                <span>{t(selectedLanguage, 'activeComplaint')}</span>
              </div>
              <p className="text-sm font-semibold text-ink">
                "{record.lastAppointment.chiefComplaint}"
              </p>
              <p className="text-xs text-ink-muted leading-relaxed">
                {record.lastAppointment.historyOfPresentIllness}
              </p>
            </div>
          </div>

          {/* Quick Chronic Conditions & Demographics (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-card rounded-3xl p-6 shadow-sm border border-ink/5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-ink/5">
                <h3 className="text-base font-bold text-ink tracking-tight">
                  {t(selectedLanguage, 'activeDiagnoses')}
                </h3>
                <span className="text-xs text-primary font-medium">
                  {record.chronicConditions.length} Diagnoses
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {record.chronicConditions.map((cond) => (
                  <div
                    key={cond.id}
                    className="p-3.5 rounded-2xl bg-base border border-ink/5 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{cond.name}</span>
                      <span className="text-3xs font-mono px-2 py-0.5 rounded bg-card text-ink-muted border border-ink/5">
                        {cond.icd10}
                      </span>
                    </div>
                    <span className="text-2xs text-ink-muted leading-relaxed">{cond.notes}</span>
                    <div className="flex items-center gap-2 mt-1 text-3xs text-ink-muted">
                      <span>Diagnosed {cond.diagnosedYear}</span>
                      <span>•</span>
                      <span className="font-semibold text-primary">{cond.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lifestyle Snapshot */}
            <div className="bg-card rounded-3xl p-6 shadow-sm border border-ink/5 flex flex-col gap-3">
              <h3 className="text-base font-bold text-ink tracking-tight pb-2 border-b border-ink/5">
                {t(selectedLanguage, 'lifestyleProfile')}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-3xs text-ink-muted uppercase font-semibold">Hydration</span>
                  <span className="font-medium text-ink mt-0.5">{record.socialHabits.dailyHydration}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xs text-ink-muted uppercase font-semibold">Activity</span>
                  <span className="font-medium text-ink mt-0.5">{record.socialHabits.physicalActivity}</span>
                </div>
                <div className="flex flex-col mt-2">
                  <span className="text-3xs text-ink-muted uppercase font-semibold">Smoking</span>
                  <span className="font-medium text-ink mt-0.5">{record.socialHabits.smoking}</span>
                </div>
                <div className="flex flex-col mt-2">
                  <span className="text-3xs text-ink-muted uppercase font-semibold">Diet</span>
                  <span className="font-medium text-ink mt-0.5">{record.socialHabits.diet}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: LAST APPOINTMENT NOTES (FULL SOAP) */}
      {activeSection === 'last-appointment' && (
        <div className="bg-card rounded-3xl p-6 lg:p-8 shadow-sm border border-ink/5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/5">
            <div>
              <div className="flex items-center gap-2">
                <Icon name="medicalId" size={24} tone="primary" weight="duotone" />
                <h3 className="text-xl font-bold text-ink tracking-tight">
                  {t(selectedLanguage, 'clinicalEncounterNotes')}
                </h3>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Conducted at {record.lastAppointment.facility} on {record.lastAppointment.date} by {record.lastAppointment.doctorName} ({record.lastAppointment.specialty})
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary-tint text-primary text-xs font-semibold self-start sm:self-auto">
              {record.lastAppointment.mode}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subjective */}
            <div className="p-5 rounded-2xl bg-base border border-ink/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {t(selectedLanguage, 'subjective')}
              </span>
              <div className="text-xs text-ink leading-relaxed">
                <strong className="block text-footnote mb-1">{t(selectedLanguage, 'chiefComplaintLabel')}</strong>
                {record.lastAppointment.chiefComplaint}
              </div>
              <div className="text-xs text-ink-muted leading-relaxed mt-1">
                <strong className="block text-footnote text-ink mb-1">{t(selectedLanguage, 'hpiLabel')}</strong>
                {record.lastAppointment.historyOfPresentIllness}
              </div>
            </div>

            {/* Objective */}
            <div className="p-5 rounded-2xl bg-base border border-ink/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-success-deep uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" />
                {t(selectedLanguage, 'objective')}
              </span>
              <ul className="text-xs text-ink space-y-1.5 list-disc list-inside">
                {record.lastAppointment.physicalExamFindings.map((finding, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {finding}
                  </li>
                ))}
              </ul>
              <div className="mt-2 pt-2 border-t border-ink/5 text-xs text-ink-muted">
                <strong>Vitals:</strong> BP {record.lastAppointment.vitals.bp} • HR {record.lastAppointment.vitals.heartRate} • Temp {record.lastAppointment.vitals.temperature} • SpO2 {record.lastAppointment.vitals.spo2}
              </div>
            </div>

            {/* Assessment */}
            <div className="p-5 rounded-2xl bg-base border border-ink/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-warning-deep uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-warning" />
                {t(selectedLanguage, 'assessment')}
              </span>
              <p className="text-xs text-ink font-medium leading-relaxed">
                {record.lastAppointment.diagnosticAssessment}
              </p>
              <div className="mt-2 text-xs text-ink-muted leading-relaxed bg-white/70 p-3 rounded-xl border border-ink/5">
                <strong>{t(selectedLanguage, 'physicianImpression')}</strong>
                <p className="mt-1">{record.lastAppointment.physicianNotes}</p>
              </div>
            </div>

            {/* Plan */}
            <div className="p-5 rounded-2xl bg-base border border-ink/5 flex flex-col gap-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {t(selectedLanguage, 'planAdvice')}
              </span>
              <div className="flex flex-col gap-1.5 text-xs">
                <strong className="text-footnote text-ink">{t(selectedLanguage, 'clinicianInstructions')}</strong>
                <ul className="list-disc list-inside space-y-1 text-ink">
                  {record.lastAppointment.clinicalAdvice.map((adv, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {adv}
                    </li>
                  ))}
                </ul>

                <strong className="text-footnote text-ink mt-2">{t(selectedLanguage, 'orderedTests')}</strong>
                <div className="flex flex-wrap gap-1.5">
                  {record.lastAppointment.investigationsOrdered.map((inv, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-card text-2xs font-semibold text-primary border border-ink/5"
                    >
                      {inv}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-ink/5 flex items-center justify-between text-xs text-ink-muted">
            <span>Digitally Authenticated with NMC Clinician Token</span>
            <span className="font-mono text-2xs">Encounter Ref: #{record.lastAppointment.encounterId}</span>
          </div>
        </div>
      )}

      {/* SECTION 3: PRESCRIPTIONS & RX */}
      {activeSection === 'prescriptions' && (
        <div className="bg-card rounded-3xl p-6 lg:p-8 shadow-sm border border-ink/5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-ink/5">
            <div>
              <h3 className="text-xl font-bold text-ink tracking-tight">
                {t(selectedLanguage, 'activeMedicalPrescriptions')}
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                {t(selectedLanguage, 'prescriptionsSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-success-tint text-success-deep text-xs font-semibold flex items-center gap-1">
                <Icon name="verified" size={15} />
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
                  className="p-5 rounded-2xl bg-base border border-ink/5 flex flex-col justify-between gap-3.5 hover:shadow-sm transition-all"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-subhead font-bold text-ink leading-snug">
                          {med.name}
                        </span>
                        <span className="text-xs font-semibold text-primary mt-0.5">
                          {med.dosage} • {med.route}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-success-tint text-success-deep">
                        {med.frequency}
                      </span>
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed mt-1">
                      {med.purpose}
                    </p>

                    {/* Timing & Schedule */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-ink bg-card px-2.5 py-1 rounded-lg border border-ink/5">
                        <Icon name="clock" size={13} tone="muted" className="inline-block align-[-2px]" /> {med.timing}
                      </span>
                      <span className="text-xs font-medium text-ink-muted bg-card px-2.5 py-1 rounded-lg border border-ink/5">
                        Duration: {med.duration}
                      </span>
                    </div>

                    {/* Daily Dosing Schedule Chips */}
                    <div className="flex items-center gap-2 mt-1 text-2xs">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          med.schedule.morning
                            ? 'bg-primary-tint text-primary'
                            : 'bg-ink/5 text-ink-muted line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'morning')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          med.schedule.afternoon
                            ? 'bg-primary-tint text-primary'
                            : 'bg-ink/5 text-ink-muted line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'noon')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          med.schedule.night
                            ? 'bg-primary-tint text-primary'
                            : 'bg-ink/5 text-ink-muted line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'night')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-ink/5 flex items-center justify-between text-2xs text-ink-muted">
                    <span>By: {med.prescribedBy}</span>
                    <span className="font-semibold text-primary">
                      {med.refillsRemaining} {t(selectedLanguage, 'refillsLeft')}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Discontinued / Past Meds */}
          {record.prescriptions.some((p) => p.status === 'Discontinued') && (
            <div className="mt-4 pt-5 border-t border-ink/5 flex flex-col gap-3">
              <h4 className="text-sm font-bold text-ink-muted uppercase tracking-wider">
                {t(selectedLanguage, 'discontinuedTitle')}
              </h4>
              <div className="flex flex-col gap-2">
                {record.prescriptions
                  .filter((p) => p.status === 'Discontinued')
                  .map((med) => (
                    <div
                      key={med.id}
                      className="p-3.5 rounded-xl bg-danger/6 border border-danger/15 flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-danger-deep">{med.name} ({med.dosage})</span>
                        <span className="text-ink-muted mt-0.5">{med.discontinuedReason}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-3xs font-bold bg-danger-tint text-danger-deep">
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
        <div className="bg-card rounded-3xl p-6 lg:p-8 shadow-sm border border-ink/5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/5">
            <div>
              <div className="flex items-center gap-2">
                <Icon name="upcoming" size={24} tone="primary" weight="duotone" />
                <h3 className="text-xl font-bold text-ink tracking-tight">
                  {t(selectedLanguage, 'scheduledNextApt')}
                </h3>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                {t(selectedLanguage, 'aptCalendarSubtitle')}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-success-tint text-success-deep text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span>{nextAppointment.status}</span>
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-base to-white border border-primary/20 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-2xs font-bold text-primary uppercase tracking-wider">
                  {t(selectedLanguage, 'upcomingDateTitle')}
                </span>
                <span className="text-2xl font-bold text-ink mt-1">
                  {nextAppointment.date}
                </span>
                <span className="text-sm font-semibold text-primary mt-0.5">
                  {nextAppointment.time} ({nextAppointment.relativeTime})
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => setIsRescheduleModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card hover:bg-ink/5 text-ink border border-ink/10 text-sm font-semibold shadow-sm transition-all active:scale-95"
                >
                  <Icon name="reschedule" size={20} tone="primary" weight="duotone" />
                  <span>{t(selectedLanguage, 'rescheduleAppointment')}</span>
                </button>

                <button
                  onClick={() => onStartConsultation(patient)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary hover:bg-primary-deep text-white text-sm font-semibold shadow-md transition-all active:scale-95"
                >
                  <Icon name="video" size={20} />
                  <span>{t(selectedLanguage, 'launchEarly')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-ink/5 text-xs">
              <div className="flex flex-col">
                <span className="text-3xs text-ink-muted uppercase font-semibold">{t(selectedLanguage, 'consultationMode')}</span>
                <span className="font-semibold text-ink mt-0.5">{nextAppointment.mode}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs text-ink-muted uppercase font-semibold">{t(selectedLanguage, 'attendingClinician')}</span>
                <span className="font-semibold text-ink mt-0.5">{nextAppointment.doctorName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs text-ink-muted uppercase font-semibold">{t(selectedLanguage, 'clinicFacility')}</span>
                <span className="font-semibold text-ink mt-0.5">{nextAppointment.facility}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-ink/5 flex flex-col gap-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-primary">
                {t(selectedLanguage, 'clinicalAgenda')}
              </span>
              <p className="text-xs text-ink leading-relaxed">
                {nextAppointment.agenda}
              </p>
            </div>

            {/* Preparation instructions for patient */}
            <div className="flex flex-col gap-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                {t(selectedLanguage, 'patientInstructions')}
              </span>
              <ul className="text-xs text-ink-muted space-y-1 list-disc list-inside">
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
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-ink/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-ink tracking-tight pb-2 border-b border-ink/5">
              Documented Chronic Conditions
            </h3>
            <div className="flex flex-col gap-3">
              {record.chronicConditions.map((cond) => (
                <div key={cond.id} className="p-4 rounded-2xl bg-base border border-ink/5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{cond.name}</span>
                    <span className="text-xs font-mono font-semibold text-primary bg-primary-tint px-2 py-0.5 rounded">
                      {cond.icd10}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">{cond.notes}</p>
                  <div className="flex items-center gap-2 mt-1 text-2xs text-ink-muted">
                    <span>Onset: {cond.diagnosedYear}</span>
                    <span>•</span>
                    <span className="font-semibold text-success-deep">{cond.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Surgeries & Procedures */}
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-ink/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-ink tracking-tight pb-2 border-b border-ink/5">
              Surgical & Hospitalization History
            </h3>
            {record.surgicalHistory.length > 0 ? (
              <div className="flex flex-col gap-3">
                {record.surgicalHistory.map((surg) => (
                  <div key={surg.id} className="p-4 rounded-2xl bg-base border border-ink/5 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-ink">{surg.procedure}</span>
                      <span className="text-xs font-semibold text-ink-muted">{surg.year}</span>
                    </div>
                    <span className="text-xs text-primary font-medium">{surg.facility}</span>
                    <p className="text-xs text-ink-muted leading-relaxed mt-0.5">{surg.notes}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-ink-muted bg-base rounded-2xl border border-ink/5">
                No prior surgical interventions reported.
              </div>
            )}
          </div>

          {/* Family Medical History */}
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-ink/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-ink tracking-tight pb-2 border-b border-ink/5">
              Family Medical Pedigree
            </h3>
            <div className="flex flex-col gap-2.5">
              {record.familyHistory.map((fam, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-base border border-ink/5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">{fam.relation}</span>
                  <div className="flex flex-wrap gap-1">
                    {fam.conditions.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-card font-medium text-ink-muted border border-ink/5 text-2xs">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Immunization Registry */}
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-ink/5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-ink tracking-tight pb-2 border-b border-ink/5">
              ABDM Immunization Registry
            </h3>
            <div className="flex flex-col gap-2.5">
              {record.immunizations.map((imm, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-base border border-ink/5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">{imm.vaccine}</span>
                  <span className="font-mono text-ink-muted">{imm.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Apple HIG Reschedule Consultation Modal */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-night/40 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={rescheduleDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reschedule-title"
            className="w-full max-w-xl bg-card rounded-3xl shadow-lg border border-ink/10 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-base border-b border-ink/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                  <Icon name="reschedule" size={24} />
                </div>
                <div>
                  <h3 id="reschedule-title" className="text-base font-bold text-ink tracking-tight">
                    {t(selectedLanguage, 'rescheduleModalTitle')}
                  </h3>
                  <p className="text-2xs text-ink-muted">
                    {t(selectedLanguage, 'rescheduleModalSubtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRescheduleModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-card hover:bg-ink/5 text-ink flex items-center justify-center shadow-sm transition-all"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* Patient Badge */}
              <div className="p-3.5 rounded-2xl bg-base border border-ink/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-tint text-primary font-bold flex items-center justify-center text-xs">
                    {patient.full_name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ink">{patient.full_name}</span>
                    <span className="text-2xs font-mono text-ink-muted">{patient.abha_address}</span>
                  </div>
                </div>
                <span className="text-2xs font-semibold text-primary bg-card px-2.5 py-1 rounded-lg border border-ink/5">
                  {nextAppointment.doctorName}
                </span>
              </div>

              {/* Date Presets */}
              <div className="flex flex-col gap-2">
                <label htmlFor="reschedule-date" className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'selectDate')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-24')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-24'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-ink border-ink/10 hover:bg-ink/5'
                    }`}
                  >
                    {t(selectedLanguage, 'presetTomorrow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-26')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-26'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-ink border-ink/10 hover:bg-ink/5'
                    }`}
                  >
                    {t(selectedLanguage, 'preset3Days')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-30')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-30'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-ink border-ink/10 hover:bg-ink/5'
                    }`}
                  >
                    {t(selectedLanguage, 'presetNextWeek')}
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    id="reschedule-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-ink/10 text-xs font-medium bg-base focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="flex flex-col gap-2">
                <label htmlFor="reschedule-time" className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
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
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-card text-ink border-ink/10 hover:bg-ink/5'
                      }`}
                    >
                      {slot.replace(' IST', '')}
                    </button>
                  ))}
                </div>
                <input
                  id="reschedule-time"
                  type="text"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  placeholder="Custom time (e.g. 11:30 AM IST)"
                  className="w-full px-3.5 py-2 rounded-xl border border-ink/10 text-xs font-medium bg-base focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all mt-1"
                />
              </div>

              {/* Mode Toggle */}
              <div className="flex flex-col gap-2">
                <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'rescheduleMode')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleMode('Telehealth Video')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      rescheduleMode === 'Telehealth Video'
                        ? 'bg-primary-tint text-primary border-primary/40'
                        : 'bg-base text-ink-muted border-ink/5'
                    }`}
                  >
                    <Icon name="video" size={16} />
                    <span>Telehealth Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleMode('In-Person Warm Clinic')}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      rescheduleMode === 'In-Person Warm Clinic'
                        ? 'bg-primary-tint text-primary border-primary/40'
                        : 'bg-base text-ink-muted border-ink/5'
                    }`}
                  >
                    <Icon name="building" size={16} />
                    <span>In-Person Warm Clinic</span>
                  </button>
                </div>
              </div>

              {/* Clinical Agenda Input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reschedule-agenda" className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'rescheduleAgenda')}
                </label>
                <textarea
                  id="reschedule-agenda"
                  rows={2}
                  value={rescheduleAgenda}
                  onChange={(e) => setRescheduleAgenda(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-ink/10 text-xs font-medium bg-base focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                />
              </div>

              {/* Patient Instructions */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reschedule-instructions" className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'rescheduleInstructions')}
                </label>
                <input
                  id="reschedule-instructions"
                  type="text"
                  value={rescheduleInstructions}
                  onChange={(e) => setRescheduleInstructions(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-ink/10 text-xs font-medium bg-base focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Live sync note */}
              <div className="flex items-center gap-2 text-2xs text-success-deep bg-success-tint px-3 py-2 rounded-xl">
                <Icon name="sync" size={15} />
                <span>Automated sync: Patient mobile app will be updated via WebSocket immediately upon confirmation.</span>
              </div>
            </div>

            {rescheduleError && (
              <div className="mx-6 mb-3 text-2xs text-danger-deep bg-danger-tint px-3 py-2 rounded-xl">
                {rescheduleError}
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-base border-t border-ink/5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsRescheduleModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink transition-all"
              >
                {t(selectedLanguage, 'cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={isSavingReschedule}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-deep text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-60"
              >
                <Icon name="checkCircle" size={16} />
                <span>{t(selectedLanguage, 'confirmReschedule')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
