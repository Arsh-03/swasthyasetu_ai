import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api, type PatientSummary } from '../services/api';
import type { PatientFullRecord, UpcomingAppointment } from '../data/patientRecords';
import { t, type SupportedLanguage, formatLocalizedName, stripNonLatinParentheses } from '../utils/translations';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';
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
    <div className="w-full flex flex-col gap-3.5">
      {(chartError || !chartData) && (
        <div
          className={`text-2xs px-3 py-2 rounded-lg ${
            chartError ? 'text-danger-deep bg-danger-tint' : 'text-ink-muted bg-fog'
          }`}
        >
          {chartError ? `Could not load the full chart: ${chartError}` : 'Loading chart from the database…'}
        </div>
      )}

      {/* Top Breadcrumb & Command Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-card-border">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={onBackToQueue}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-deep transition-colors cursor-pointer group"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Queue</span>
          </button>
          <span className="text-ink-muted">/</span>
          <span className="text-xs font-bold text-ink truncate max-w-xs">
            {formatLocalizedName(record.fullName, selectedLanguage)}
          </span>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onViewClinicalRecords}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card hover:bg-ink/5 text-ink text-xs font-semibold border border-card-border shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Icon name="records" size={14} tone="primary" weight="duotone" />
            <span>{t(selectedLanguage, 'abdmVault')}</span>
          </button>

          <button
            type="button"
            onClick={onRequestConsent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card hover:bg-ink/5 text-ink text-xs font-semibold border border-card-border shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Icon name="key" size={14} tone="warning" weight="duotone" />
            <span>{t(selectedLanguage, 'requestConsent')}</span>
          </button>

          <button
            type="button"
            onClick={() => onStartConsultation(patient)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-deep text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Icon name="video" size={15} />
            <span>{t(selectedLanguage, 'startVideoCall')}</span>
          </button>
        </div>
      </div>

      {/* Compact Patient Identity Banner (4.b) */}
      <div className="bg-card rounded-xl p-4 shadow-2xs border border-card-border flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3.5 min-w-0">
          <Avatar
            src={patient.avatar_url}
            name={formatLocalizedName(record.fullName, selectedLanguage)}
            size={56}
            domain="records"
            className="rounded-xl shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-ink tracking-tight truncate">
                {formatLocalizedName(record.fullName, selectedLanguage)}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-success-tint text-success-deep shrink-0">
                <Icon name="verified" size={13} />
                <span>{t(selectedLanguage, 'abdmVerified')}</span>
              </span>
              {record.bloodGroup && (
                <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-primary-tint text-primary shrink-0">
                  {record.bloodGroup}
                </span>
              )}
              {nextAppointment && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-fog text-ink-muted shrink-0 border border-card-border">
                  <Icon name="calendar" size={12} tone="primary" />
                  <span className="text-ink font-semibold">Next: {nextAppointment.date}</span>
                </span>
              )}
            </div>

            <div className="text-xs text-ink-muted flex flex-wrap items-center gap-1.5 mt-0.5 font-sans">
              <span>{record.age} yrs</span>
              <span>•</span>
              <span>{record.gender}</span>
              <span>•</span>
              <span>{record.occupation}</span>
              <span>•</span>
              <span className="text-ink font-medium">{record.district}</span>
              <span>•</span>
              <span className="font-mono text-2xs text-ink-muted">
                ABHA: <span className="text-primary font-semibold">{record.abhaAddress}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Emergency contact inline on the right */}
        <div className="flex items-center gap-3 lg:border-l lg:border-card-border lg:pl-4 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-danger-deep bg-danger-tint px-2.5 py-1 rounded-lg border border-danger/15">
            <Icon name="emergency" size={14} tone="danger" weight="duotone" />
            <span className="text-3xs font-bold uppercase tracking-wider">Emergency:</span>
            <span className="font-semibold text-ink">{stripNonLatinParentheses(record.emergencyContact.name)}</span>
            <span className="font-mono text-primary font-bold ml-1">{record.emergencyContact.phone}</span>
          </div>
        </div>
      </div>

      {/* Thin full-width danger-tint allergy strip under the banner (4.c) */}
      {record.allergies && record.allergies.length > 0 && (
        <div className="w-full px-3.5 py-1.5 rounded-lg bg-danger-tint text-danger-deep border border-danger/25 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon name="warning" size={14} tone="danger" weight="duotone" />
            <span className="font-bold text-3xs uppercase tracking-wider">Known Allergies:</span>
            <span className="font-semibold">
              {record.allergies.map((a) => `${stripNonLatinParentheses(a.allergen)} (${stripNonLatinParentheses(a.severity || 'Critical')})`).join(', ')}
            </span>
          </div>
          <span className="text-3xs text-danger-deep/80 font-mono">
            DPDP / ABDM Verified
          </span>
        </div>
      )}

      {/* Tabs: Clean with no duplicate badges or pulse dots (4.d) */}
      <div className="flex items-center p-1 rounded-xl bg-fog/50 border border-card-border overflow-x-auto gap-1">
        <button
          onClick={() => setActiveSection('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 ${
            activeSection === 'overview'
              ? 'bg-card text-ink shadow-2xs font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-card/40 font-medium'
          }`}
        >
          {t(selectedLanguage, 'tabOverview')}
        </button>

        <button
          onClick={() => setActiveSection('last-appointment')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 ${
            activeSection === 'last-appointment'
              ? 'bg-card text-ink shadow-2xs font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-card/40 font-medium'
          }`}
        >
          {t(selectedLanguage, 'tabLastEncounter')}
        </button>

        <button
          onClick={() => setActiveSection('prescriptions')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 ${
            activeSection === 'prescriptions'
              ? 'bg-card text-ink shadow-2xs font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-card/40 font-medium'
          }`}
        >
          {t(selectedLanguage, 'tabPrescriptions')}
        </button>

        <button
          onClick={() => setActiveSection('next-appointment')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 ${
            activeSection === 'next-appointment'
              ? 'bg-card text-ink shadow-2xs font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-card/40 font-medium'
          }`}
        >
          {t(selectedLanguage, 'tabNextAppointment')}
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 ${
            activeSection === 'history'
              ? 'bg-card text-ink shadow-2xs font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-card/40 font-medium'
          }`}
        >
          {t(selectedLanguage, 'tabFullHistory')}
        </button>
      </div>

      {/* SECTION 1: OVERVIEW & VITALS (4.e & 4.f) */}
      {activeSection === 'overview' && (
        <div className="flex flex-col gap-3.5">
          {/* Row of 6 Vitals Tiles (3x2 below 1280px) - White with 1px border */}
          <div className="grid grid-cols-3 xl:grid-cols-6 gap-2.5">
            <div className="p-3 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'bloodPressure')}</span>
              <span className="text-base sm:text-lg font-bold text-ink mt-0.5 leading-tight">{record.lastAppointment.vitals.bp}</span>
              <span className="text-2xs text-success-deep font-medium mt-0.5 truncate">{t(selectedLanguage, 'optimalRange')}</span>
            </div>

            <div className="p-3 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'heartRate')}</span>
              <span className="text-base sm:text-lg font-bold text-ink mt-0.5 leading-tight">{record.lastAppointment.vitals.heartRate}</span>
              <span className="text-2xs text-success-deep font-medium mt-0.5 truncate">{t(selectedLanguage, 'regularRhythm')}</span>
            </div>

            <div className="p-3 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'temperature')}</span>
              <span className="text-base sm:text-lg font-bold text-ink mt-0.5 leading-tight">{record.lastAppointment.vitals.temperature}</span>
              <span className="text-2xs text-ink-muted font-medium mt-0.5 truncate">Oral Thermometry</span>
            </div>

            <div className="p-3 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'oxygenSaturation')}</span>
              <span className="text-base sm:text-lg font-bold text-ink mt-0.5 leading-tight">{record.lastAppointment.vitals.spo2}</span>
              <span className="text-2xs text-success-deep font-medium mt-0.5 truncate">{t(selectedLanguage, 'ambientAir')}</span>
            </div>

            <div className="p-3 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'respiratoryRate')}</span>
              <span className="text-base sm:text-lg font-bold text-ink mt-0.5 leading-tight">{record.lastAppointment.vitals.respiratoryRate}</span>
              <span className="text-2xs text-ink-muted font-medium mt-0.5 truncate">Unlabored</span>
            </div>

            <div className="p-3 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col">
              <span className="text-3xs font-semibold text-ink-muted uppercase tracking-wider">{t(selectedLanguage, 'bmiIndex')}</span>
              <span className="text-base sm:text-lg font-bold text-ink mt-0.5 leading-tight">{record.lastAppointment.vitals.bmi}</span>
              <span className="text-2xs text-success-deep font-medium mt-0.5 truncate">Normal Weight</span>
            </div>
          </div>

          {/* Active Conditions and Chief Complaint Side by Side with align-items:start */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
            {/* Active Diagnoses Card */}
            <div className="bg-card rounded-xl p-4 shadow-2xs border border-card-border flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-card-border">
                <h2 className="text-base font-semibold text-ink tracking-tight">
                  {t(selectedLanguage, 'activeDiagnoses')}
                </h2>
                <span className="text-xs text-primary font-medium">
                  {record.chronicConditions.length} Diagnoses
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {record.chronicConditions.map((cond) => (
                  <div
                    key={cond.id}
                    className="p-3 rounded-lg bg-base border border-card-border flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{stripNonLatinParentheses(cond.name)}</span>
                      <span className="text-3xs font-mono px-2 py-0.5 rounded bg-card text-ink-muted border border-card-border">
                        {cond.icd10}
                      </span>
                    </div>
                    <span className="text-2xs text-ink-muted leading-relaxed">{stripNonLatinParentheses(cond.notes)}</span>
                    <div className="flex items-center gap-2 mt-0.5 text-3xs text-ink-muted">
                      <span>Diagnosed {cond.diagnosedYear}</span>
                      <span>•</span>
                      <span className="font-semibold text-primary">{cond.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chief Complaint Callout Card */}
            <div className="bg-card rounded-xl p-4 shadow-2xs border border-card-border flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-card-border">
                <div className="flex items-center gap-1.5">
                  <Icon name="doctor" size={16} tone="primary" />
                  <h2 className="text-base font-semibold text-ink tracking-tight">
                    {t(selectedLanguage, 'activeComplaint')}
                  </h2>
                </div>
                <span className="text-xs text-ink-muted">
                  {record.lastAppointment.date}
                </span>
              </div>
              <p className="text-sm font-semibold text-ink">
                "{stripNonLatinParentheses(record.lastAppointment.chiefComplaint)}"
              </p>
              <p className="text-xs text-ink-muted leading-relaxed">
                {stripNonLatinParentheses(record.lastAppointment.historyOfPresentIllness)}
              </p>
            </div>
          </div>

          {/* Social & Lifestyle Profile as a Compact Row */}
          <div className="bg-card rounded-xl p-3 px-4 shadow-2xs border border-card-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-xs font-semibold text-ink uppercase tracking-wider shrink-0">
              {t(selectedLanguage, 'lifestyleProfile')}:
            </span>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-3xs text-ink-muted uppercase font-semibold">Hydration:</span>
                <span className="font-medium text-ink">{record.socialHabits.dailyHydration}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-3xs text-ink-muted uppercase font-semibold">Activity:</span>
                <span className="font-medium text-ink">{record.socialHabits.physicalActivity}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-3xs text-ink-muted uppercase font-semibold">Smoking:</span>
                <span className="font-medium text-ink">{record.socialHabits.smoking}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-3xs text-ink-muted uppercase font-semibold">Diet:</span>
                <span className="font-medium text-ink">{record.socialHabits.diet}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: LAST APPOINTMENT NOTES (FULL SOAP) */}
      {activeSection === 'last-appointment' && (
        <div className="bg-card rounded-xl p-4 sm:p-5 shadow-2xs border border-card-border flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-card-border">
            <div>
              <div className="flex items-center gap-2">
                <Icon name="medicalId" size={20} tone="primary" weight="duotone" />
                <h2 className="text-base font-semibold text-ink tracking-tight">
                  {t(selectedLanguage, 'clinicalEncounterNotes')}
                </h2>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Conducted at {record.lastAppointment.facility} on {record.lastAppointment.date} by {stripNonLatinParentheses(record.lastAppointment.doctorName)} ({record.lastAppointment.specialty})
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-primary-tint text-primary text-2xs font-semibold self-start sm:self-auto">
              {record.lastAppointment.mode}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Subjective */}
            <div className="p-3.5 rounded-lg bg-base border border-card-border flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {t(selectedLanguage, 'subjective')}
              </span>
              <div className="text-xs text-ink leading-relaxed">
                <strong className="block text-footnote mb-0.5">{t(selectedLanguage, 'chiefComplaintLabel')}</strong>
                {stripNonLatinParentheses(record.lastAppointment.chiefComplaint)}
              </div>
              <div className="text-xs text-ink-muted leading-relaxed mt-1">
                <strong className="block text-footnote text-ink mb-0.5">{t(selectedLanguage, 'hpiLabel')}</strong>
                {stripNonLatinParentheses(record.lastAppointment.historyOfPresentIllness)}
              </div>
            </div>

            {/* Objective */}
            <div className="p-3.5 rounded-lg bg-base border border-card-border flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-success-deep uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {t(selectedLanguage, 'objective')}
              </span>
              <ul className="text-xs text-ink space-y-1 list-disc list-inside">
                {record.lastAppointment.physicalExamFindings.map((finding, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {stripNonLatinParentheses(finding)}
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 pt-1.5 border-t border-card-border text-xs text-ink-muted">
                <strong>Vitals:</strong> BP {record.lastAppointment.vitals.bp} • HR {record.lastAppointment.vitals.heartRate} • Temp {record.lastAppointment.vitals.temperature} • SpO2 {record.lastAppointment.vitals.spo2}
              </div>
            </div>

            {/* Assessment */}
            <div className="p-3.5 rounded-lg bg-base border border-card-border flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-warning-deep uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                {t(selectedLanguage, 'assessment')}
              </span>
              <p className="text-xs text-ink font-medium leading-relaxed">
                {stripNonLatinParentheses(record.lastAppointment.diagnosticAssessment)}
              </p>
              <div className="mt-1.5 text-xs text-ink-muted leading-relaxed bg-card p-2.5 rounded-md border border-card-border">
                <strong>{t(selectedLanguage, 'physicianImpression')}</strong>
                <p className="mt-0.5">{stripNonLatinParentheses(record.lastAppointment.physicianNotes)}</p>
              </div>
            </div>

            {/* Plan */}
            <div className="p-3.5 rounded-lg bg-base border border-card-border flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {t(selectedLanguage, 'planAdvice')}
              </span>
              <div className="flex flex-col gap-1 text-xs">
                <strong className="text-footnote text-ink">{t(selectedLanguage, 'clinicianInstructions')}</strong>
                <ul className="list-disc list-inside space-y-1 text-ink">
                  {record.lastAppointment.clinicalAdvice.map((adv, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {adv}
                    </li>
                  ))}
                </ul>

                <strong className="text-footnote text-ink mt-1.5">{t(selectedLanguage, 'orderedTests')}</strong>
                <div className="flex flex-wrap gap-1.5">
                  {record.lastAppointment.investigationsOrdered.map((inv, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-card text-2xs font-semibold text-primary border border-card-border"
                    >
                      {inv}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-card-border flex items-center justify-between text-xs text-ink-muted">
            <span>Digitally Authenticated with NMC Clinician Token</span>
            <span className="font-mono text-2xs">Encounter Ref: #{record.lastAppointment.encounterId}</span>
          </div>
        </div>
      )}

      {/* SECTION 3: PRESCRIPTIONS & RX */}
      {activeSection === 'prescriptions' && (
        <div className="bg-card rounded-xl p-4 sm:p-5 shadow-2xs border border-card-border flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-card-border">
            <div>
              <h2 className="text-base font-semibold text-ink tracking-tight">
                {t(selectedLanguage, 'activeMedicalPrescriptions')}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                {t(selectedLanguage, 'prescriptionsSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-success-tint text-success-deep text-2xs font-semibold flex items-center gap-1">
                <Icon name="verified" size={13} />
                <span>{t(selectedLanguage, 'cdssSafetyCleared')}</span>
              </span>
            </div>
          </div>

          {/* Active Meds Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {record.prescriptions
              .filter((p) => p.status === 'Active')
              .map((med) => (
                <div
                  key={med.id}
                  className="p-3.5 rounded-lg bg-base border border-card-border flex flex-col justify-between gap-2.5 hover:shadow-2xs transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ink leading-snug">
                          {stripNonLatinParentheses(med.name)}
                        </span>
                        <span className="text-xs font-medium text-primary mt-0.5">
                          {med.dosage} • {med.route}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-success-tint text-success-deep">
                        {med.frequency}
                      </span>
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed mt-0.5">
                      {stripNonLatinParentheses(med.purpose)}
                    </p>

                    {/* Timing & Schedule */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-ink bg-card px-2 py-0.5 rounded-md border border-card-border">
                        <Icon name="clock" size={12} tone="muted" className="inline-block align-[-2px]" /> {med.timing}
                      </span>
                      <span className="text-xs font-medium text-ink-muted bg-card px-2 py-0.5 rounded-md border border-card-border">
                        Duration: {med.duration}
                      </span>
                    </div>

                    {/* Daily Dosing Schedule Chips */}
                    <div className="flex items-center gap-1.5 mt-1 text-3xs">
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${
                          med.schedule.morning
                            ? 'bg-primary-tint text-primary'
                            : 'bg-fog text-ink-muted line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'morning')}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${
                          med.schedule.afternoon
                            ? 'bg-primary-tint text-primary'
                            : 'bg-fog text-ink-muted line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'noon')}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${
                          med.schedule.night
                            ? 'bg-primary-tint text-primary'
                            : 'bg-fog text-ink-muted line-through'
                        }`}
                      >
                        {t(selectedLanguage, 'night')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-card-border flex items-center justify-between text-2xs text-ink-muted">
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
            <div className="mt-2 pt-3 border-t border-card-border flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                {t(selectedLanguage, 'discontinuedTitle')}
              </h3>
              <div className="flex flex-col gap-1.5">
                {record.prescriptions
                  .filter((p) => p.status === 'Discontinued')
                  .map((med) => (
                    <div
                      key={med.id}
                      className="p-2.5 rounded-lg bg-danger/5 border border-danger/20 flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-danger-deep">{med.name} ({med.dosage})</span>
                        <span className="text-ink-muted mt-0.5">{med.discontinuedReason}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-danger-tint text-danger-deep">
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
        <div className="bg-card rounded-xl p-4 sm:p-5 shadow-2xs border border-card-border flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-card-border">
            <div>
              <div className="flex items-center gap-2">
                <Icon name="upcoming" size={20} tone="primary" weight="duotone" />
                <h2 className="text-base font-semibold text-ink tracking-tight">
                  {t(selectedLanguage, 'scheduledNextApt')}
                </h2>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                {t(selectedLanguage, 'aptCalendarSubtitle')}
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-success-tint text-success-deep text-2xs font-semibold flex items-center gap-1.5 self-start sm:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span>{nextAppointment.status}</span>
            </span>
          </div>

          <div className="p-4 rounded-lg bg-card border border-card-border shadow-2xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-3xs font-semibold text-primary uppercase tracking-wider">
                  {t(selectedLanguage, 'upcomingDateTitle')}
                </span>
                <span className="text-xl font-bold text-ink mt-0.5">
                  {nextAppointment.date}
                </span>
                <span className="text-xs font-semibold text-primary mt-0.5">
                  {nextAppointment.time} ({nextAppointment.relativeTime})
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsRescheduleModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card hover:bg-ink/5 text-ink border border-card-border text-xs font-semibold shadow-2xs transition-all active:scale-95"
                >
                  <Icon name="reschedule" size={16} tone="primary" weight="duotone" />
                  <span>{t(selectedLanguage, 'rescheduleAppointment')}</span>
                </button>

                <button
                  onClick={() => onStartConsultation(patient)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-deep text-white text-xs font-semibold shadow-2xs transition-all active:scale-95"
                >
                  <Icon name="video" size={16} />
                  <span>{t(selectedLanguage, 'launchEarly')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-card-border text-xs">
              <div className="flex flex-col">
                <span className="text-3xs text-ink-muted uppercase font-semibold">{t(selectedLanguage, 'consultationMode')}</span>
                <span className="font-semibold text-ink mt-0.5">{nextAppointment.mode}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs text-ink-muted uppercase font-semibold">{t(selectedLanguage, 'attendingClinician')}</span>
                <span className="font-semibold text-ink mt-0.5">{stripNonLatinParentheses(nextAppointment.doctorName)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-3xs text-ink-muted uppercase font-semibold">{t(selectedLanguage, 'clinicFacility')}</span>
                <span className="font-semibold text-ink mt-0.5">{nextAppointment.facility}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-base border border-card-border flex flex-col gap-1">
              <span className="text-3xs font-semibold uppercase tracking-wider text-primary">
                {t(selectedLanguage, 'clinicalAgenda')}
              </span>
              <p className="text-xs text-ink leading-relaxed">
                {nextAppointment.agenda}
              </p>
            </div>

            {/* Preparation instructions for patient */}
            <div className="flex flex-col gap-1.5">
              <span className="text-3xs font-semibold uppercase tracking-wider text-ink-muted">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chronic Conditions & ICD-10 */}
          <div className="bg-card rounded-xl p-4 shadow-2xs border border-card-border flex flex-col gap-3">
            <h2 className="text-base font-semibold text-ink tracking-tight pb-2 border-b border-card-border">
              Documented Chronic Conditions
            </h2>
            <div className="flex flex-col gap-2.5">
              {record.chronicConditions.map((cond) => (
                <div key={cond.id} className="p-3 rounded-lg bg-base border border-card-border flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{stripNonLatinParentheses(cond.name)}</span>
                    <span className="text-3xs font-mono font-semibold text-primary bg-primary-tint px-2 py-0.5 rounded">
                      {cond.icd10}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">{stripNonLatinParentheses(cond.notes)}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-3xs text-ink-muted">
                    <span>Onset: {cond.diagnosedYear}</span>
                    <span>•</span>
                    <span className="font-semibold text-success-deep">{cond.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Surgeries & Procedures */}
          <div className="bg-card rounded-xl p-4 shadow-2xs border border-card-border flex flex-col gap-3">
            <h2 className="text-base font-semibold text-ink tracking-tight pb-2 border-b border-card-border">
              Surgical & Hospitalization History
            </h2>
            {record.surgicalHistory.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {record.surgicalHistory.map((surg) => (
                  <div key={surg.id} className="p-3 rounded-lg bg-base border border-card-border flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{stripNonLatinParentheses(surg.procedure)}</span>
                      <span className="text-xs font-semibold text-ink-muted">{surg.year}</span>
                    </div>
                    <span className="text-xs text-primary font-medium">{stripNonLatinParentheses(surg.facility)}</span>
                    <p className="text-xs text-ink-muted leading-relaxed mt-0.5">{stripNonLatinParentheses(surg.notes)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-ink-muted bg-base rounded-lg border border-card-border">
                No prior surgical interventions reported.
              </div>
            )}
          </div>

          {/* Family Medical History */}
          <div className="bg-card rounded-xl p-4 shadow-2xs border border-card-border flex flex-col gap-3">
            <h2 className="text-base font-semibold text-ink tracking-tight pb-2 border-b border-card-border">
              Family Medical Pedigree
            </h2>
            <div className="flex flex-col gap-2">
              {record.familyHistory.map((fam, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-base border border-card-border flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">{fam.relation}</span>
                  <div className="flex flex-wrap gap-1">
                    {fam.conditions.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-card font-medium text-ink-muted border border-card-border text-2xs">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Immunization Registry */}
          <div className="bg-card rounded-xl p-4 shadow-2xs border border-card-border flex flex-col gap-3">
            <h2 className="text-base font-semibold text-ink tracking-tight pb-2 border-b border-card-border">
              ABDM Immunization Registry
            </h2>
            <div className="flex flex-col gap-2">
              {record.immunizations.map((imm, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-base border border-card-border flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">{imm.vaccine}</span>
                  <span className="font-mono text-ink-muted">{imm.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Consultation Modal */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-night/40 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={rescheduleDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reschedule-title"
            className="w-full max-w-xl bg-card rounded-xl shadow-lg border border-card-border overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-base border-b border-card-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-tint text-primary flex items-center justify-center">
                  <Icon name="reschedule" size={18} />
                </div>
                <div>
                  <h3 id="reschedule-title" className="text-sm font-semibold text-ink tracking-tight">
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
                className="w-7 h-7 rounded-full bg-card hover:bg-ink/5 text-ink flex items-center justify-center shadow-2xs transition-all border border-card-border"
              >
                <Icon name="close" size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto">
              {/* Patient Badge */}
              <div className="p-3 rounded-lg bg-base border border-card-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-tint text-primary font-bold flex items-center justify-center text-xs">
                    {formatLocalizedName(patient.full_name, selectedLanguage).charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-ink">{formatLocalizedName(patient.full_name, selectedLanguage)}</span>
                    <span className="text-2xs font-mono text-ink-muted">{patient.abha_address}</span>
                  </div>
                </div>
                <span className="text-2xs font-semibold text-primary bg-card px-2 py-0.5 rounded-md border border-card-border">
                  {stripNonLatinParentheses(nextAppointment.doctorName)}
                </span>
              </div>

              {/* Date Presets */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reschedule-date" className="text-3xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'selectDate')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-24')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-24'
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-card text-ink border-card-border hover:bg-fog'
                    }`}
                  >
                    {t(selectedLanguage, 'presetTomorrow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-26')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-26'
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-card text-ink border-card-border hover:bg-fog'
                    }`}
                  >
                    {t(selectedLanguage, 'preset3Days')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate('2026-10-30')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                      rescheduleDate === '2026-10-30'
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-card text-ink border-card-border hover:bg-fog'
                    }`}
                  >
                    {t(selectedLanguage, 'presetNextWeek')}
                  </button>
                </div>
                <div className="relative mt-0.5">
                  <input
                    id="reschedule-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-card-border text-xs font-medium bg-card focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reschedule-time" className="text-3xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'selectTime')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {['09:30 AM IST', '11:00 AM IST', '02:30 PM IST', '04:30 PM IST', '06:00 PM IST'].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setRescheduleTime(slot)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                        rescheduleTime === slot
                          ? 'bg-primary text-white border-primary shadow-2xs'
                          : 'bg-card text-ink border-card-border hover:bg-fog'
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
                  className="w-full px-3 py-2 rounded-lg border border-card-border text-xs font-medium bg-card focus:outline-none focus:ring-1 focus:ring-primary transition-all mt-0.5"
                />
              </div>

              {/* Mode Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'rescheduleMode')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleMode('Telehealth Video')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      rescheduleMode === 'Telehealth Video'
                        ? 'bg-primary-tint text-primary border-primary/40'
                        : 'bg-base text-ink-muted border-card-border'
                    }`}
                  >
                    <Icon name="video" size={15} />
                    <span>Telehealth Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleMode('In-Person Warm Clinic')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      rescheduleMode === 'In-Person Warm Clinic'
                        ? 'bg-primary-tint text-primary border-primary/40'
                        : 'bg-base text-ink-muted border-card-border'
                    }`}
                  >
                    <Icon name="building" size={15} />
                    <span>In-Person Warm Clinic</span>
                  </button>
                </div>
              </div>

              {/* Clinical Agenda Input */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reschedule-agenda" className="text-3xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'rescheduleAgenda')}
                </label>
                <textarea
                  id="reschedule-agenda"
                  rows={2}
                  value={rescheduleAgenda}
                  onChange={(e) => setRescheduleAgenda(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-card-border text-xs font-medium bg-card focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              {/* Patient Instructions */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reschedule-instructions" className="text-3xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t(selectedLanguage, 'rescheduleInstructions')}
                </label>
                <input
                  id="reschedule-instructions"
                  type="text"
                  value={rescheduleInstructions}
                  onChange={(e) => setRescheduleInstructions(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-card-border text-xs font-medium bg-card focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              {/* Live sync note */}
              <div className="flex items-center gap-2 text-2xs text-success-deep bg-success-tint px-3 py-2 rounded-lg border border-success/20">
                <Icon name="sync" size={14} />
                <span>Automated sync: Patient mobile app will be updated via WebSocket immediately upon confirmation.</span>
              </div>
            </div>

            {rescheduleError && (
              <div className="mx-5 mb-2 text-2xs text-danger-deep bg-danger-tint px-3 py-2 rounded-lg border border-danger/20">
                {rescheduleError}
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-base border-t border-card-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsRescheduleModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink transition-all"
              >
                {t(selectedLanguage, 'cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={isSavingReschedule}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-deep text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60"
              >
                <Icon name="checkCircle" size={15} />
                <span>{t(selectedLanguage, 'confirmReschedule')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
