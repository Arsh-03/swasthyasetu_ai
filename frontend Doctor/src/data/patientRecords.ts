export interface MedicalCondition {
  id: string;
  name: string;
  icd10: string;
  diagnosedYear: number;
  status: 'Active' | 'Managed' | 'Resolved';
  severity: 'Mild' | 'Moderate' | 'Severe';
  notes: string;
}

export interface SurgicalHistoryItem {
  id: string;
  procedure: string;
  year: number;
  facility: string;
  surgeon?: string;
  notes: string;
}

export interface AllergyItem {
  id: string;
  allergen: string;
  reaction: string;
  severity: 'Critical' | 'Moderate' | 'Mild';
  diagnosedDate: string;
}

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  timing: string; // e.g. "After food", "Before breakfast"
  duration: string;
  purpose: string;
  schedule: {
    morning: boolean;
    afternoon: boolean;
    night: boolean;
  };
  refillsRemaining: number;
  prescribedBy: string;
  prescribedDate: string;
  status: 'Active' | 'Discontinued';
  discontinuedReason?: string;
}

export interface ClinicalEncounterNote {
  encounterId: string;
  date: string;
  facility: string;
  doctorName: string;
  specialty: string;
  mode: 'Telehealth Video' | 'In-Person Warm Clinic';
  chiefComplaint: string;
  historyOfPresentIllness: string;
  vitals: {
    bp: string;
    heartRate: string;
    temperature: string;
    spo2: string;
    respiratoryRate: string;
    bmi: string;
    bloodGlucose?: string;
  };
  physicalExamFindings: string[];
  diagnosticAssessment: string;
  physicianNotes: string;
  clinicalAdvice: string[];
  investigationsOrdered: string[];
}

export interface UpcomingAppointment {
  appointmentId: string;
  date: string;
  time: string;
  relativeTime: string;
  mode: 'Telehealth Video' | 'In-Person Warm Clinic';
  doctorName: string;
  specialty: string;
  facility: string;
  agenda: string;
  status: 'Confirmed by Patient' | 'Pending Confirmation';
  instructionsForPatient: string[];
  patientId?: string;
  isRescheduled?: boolean;
}

export interface PatientFullRecord {
  patientId: string;
  fullName: string;
  abhaAddress: string;
  abhaNumber: string;
  phoneNumber: string;
  gender: string;
  age: number;
  dateOfBirth: string;
  bloodGroup: string;
  preferredLanguage: string;
  occupation: string;
  district: string;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  insurancePolicy?: {
    scheme: string;
    id: string;
    status: string;
  };
  chronicConditions: MedicalCondition[];
  surgicalHistory: SurgicalHistoryItem[];
  allergies: AllergyItem[];
  familyHistory: { relation: string; conditions: string[] }[];
  socialHabits: {
    smoking: string;
    alcohol: string;
    physicalActivity: string;
    dailyHydration: string;
    diet: string;
  };
  immunizations: { vaccine: string; date: string; status: 'Verified' | 'Due' }[];
  lastAppointment: ClinicalEncounterNote;
  prescriptions: MedicationItem[];
  nextAppointment: UpcomingAppointment;
}
