export type SupportedLanguage = 'en' | 'kn' | 'hi';

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Header & Navigation
    patientQueue: 'Patient Queue',
    patientChart: 'Patient Chart',
    clinicalRecords: 'Clinical Records',
    auditTrail: 'DPDP Audit Trail',
    searchPlaceholder: 'Search patients, ABHA, symptom...',
    available: 'Available',
    inCall: 'In Call',
    activeCall: 'Active Call',
    signOut: 'Sign out',
    clinicianStudio: 'Clinician Studio',
    languageNotification: 'Language switched to English',

    // Queue Metrics
    queueActive: 'Queue Active',
    activeWaiting: 'high priority waiting',
    scheduledToday: 'Scheduled Today',
    nextIn: 'Next in 12 min',
    consentsGranted: 'Consents Granted',
    dpdpActiveTokens: 'DPDP Active Tokens',
    triageQueue: 'Triage Queue',
    waitingTag: 'Waiting',
    clickToOpen: 'Click any patient to open chart',
    urgent: 'Urgent',
    followUp: 'Follow-up',
    routine: 'Routine',
    viewChart: 'View Chart',

    // Inspector
    listenSummary: 'Listen Summary',
    emergencyComplaint: 'Acute condition',
    abdmVerified: 'ABDM Verified',
    previousVisit: 'Previous Visit',
    latestVitals: 'Latest Vitals',
    language: 'Language',
    activeRxTitle: 'Active Patient Medications (Rx)',
    openFullChartBtn: 'Open Full Medical Chart',
    callBtn: 'Call',
    startConsultationWith: 'Start Consultation with',

    // Chart Header
    backToQueue: 'Patient Queue',
    comprehensiveChart: 'Comprehensive Medical Chart',
    abdmVault: 'ABDM Vault',
    requestConsent: 'Request Consent',
    startVideoCall: 'Start Video Call',
    emergencyContact: 'Emergency Contact',

    // Metric Cards
    nextAppointment: 'Next Appointment',
    lastConsultation: 'Last Consultation',
    prescriptionsRx: 'Prescriptions (Rx)',
    active: 'Active',
    ddiSafety: '0 DDI Interactions',
    lastDispensed: 'Last Dispensed',
    allergiesAndAlerts: 'Allergies & Alerts',
    noKnownAllergies: 'No Known Allergies',
    nkaReported: 'NKA Reported',

    // Sub-navigation Tabs
    tabOverview: 'Overview & Vitals',
    tabLastEncounter: 'Encounter Notes',
    tabPrescriptions: 'Prescriptions',
    tabNextAppointment: 'Appointments',
    tabFullHistory: 'Medical History',

    // Vitals Section
    latestRecordedVitals: 'Latest Recorded Vitals',
    recordedOn: 'Recorded',
    bloodPressure: 'Blood Pressure',
    heartRate: 'Heart Rate',
    temperature: 'Temperature',
    oxygenSaturation: 'Oxygen Saturation',
    respiratoryRate: 'Respiratory Rate',
    bmiIndex: 'BMI Index',
    optimalRange: 'Optimal Range',
    regularRhythm: 'Regular Rhythm',
    ambientAir: 'Ambient Air',
    activeComplaint: 'Active Chief Complaint',
    activeDiagnoses: 'Active Conditions',
    lifestyleProfile: 'Social & Lifestyle Profile',

    // SOAP Section
    clinicalEncounterNotes: 'Clinical Encounter Notes (SOAP Format)',
    subjective: 'Subjective (S)',
    objective: 'Objective (O) - Physical Exam',
    assessment: 'Assessment (A) - Diagnosis',
    planAdvice: 'Plan (P) - Advice & Orders',
    chiefComplaintLabel: 'Chief Complaint:',
    hpiLabel: 'History of Present Illness:',
    physicianImpression: 'Physician Clinical Impression:',
    clinicianInstructions: 'Clinician Instructions:',
    orderedTests: 'Ordered Tests:',

    // Prescriptions Section
    activeMedicalPrescriptions: 'Active Medical Prescriptions',
    prescriptionsSubtitle: 'ABDM verified pharmacopeia ledger with automated cross-allergy checks',
    cdssSafetyCleared: 'CDSS Safety Cleared',
    morning: 'Morning',
    noon: 'Noon',
    night: 'Night',
    refillsLeft: 'Refill(s) left',
    discontinuedTitle: 'Discontinued Medications & Adverse Reaction History',

    // Next Appointment Section
    scheduledNextApt: 'Scheduled Next Appointment',
    aptCalendarSubtitle: 'Automated ABDM telehealth appointment calendar',
    upcomingDateTitle: 'Upcoming Consultation Date & Time',
    launchEarly: 'Launch Consultation Early',
    consultationMode: 'Consultation Mode',
    attendingClinician: 'Attending Clinician',
    clinicFacility: 'Clinic Facility',
    clinicalAgenda: 'Clinical Agenda & Follow-up Objectives',
    patientInstructions: 'Patient Pre-Visit Instructions (Dispatched via WhatsApp / SMS):',

    // Vault Section
    vaultTitle: 'ABDM Clinical Records Vault',
    encryptedArtifacts: 'Encrypted Health Artifacts for',
    requestConsentToken: 'Request Consent Token',
    decrypted: 'Decrypted',
    consentGated: 'Consent Gated',
    clinicalFindings: 'Clinical Findings',
    dpdpNote: 'DPDP Security Note',
    viewScan: 'View Scan',
    authorize: 'Authorize',
    done: 'Done',

    // Reschedule
    reschedule: 'Reschedule',
    rescheduleAppointment: 'Reschedule Appointment',
    rescheduleModalTitle: 'Reschedule Patient Appointment',
    rescheduleModalSubtitle: 'Update ABDM appointment schedule & dispatch real-time notification to patient',
    presetTomorrow: 'Tomorrow (24 Oct)',
    preset3Days: 'In 3 Days (26 Oct)',
    presetNextWeek: 'Next Week (30 Oct)',
    selectDate: 'Date',
    selectTime: 'Time Slot',
    rescheduleMode: 'Consultation Mode',
    rescheduleAgenda: 'Clinical Agenda & Objectives',
    rescheduleInstructions: 'Pre-Visit Instructions (SMS / App Push)',
    confirmReschedule: 'Confirm & Dispatch to Patient',
    cancel: 'Cancel',
    rescheduleSuccessNotice: 'Appointment successfully rescheduled and sent to patient!',
  },

  kn: {
    // Header & Navigation
    patientQueue: 'ರೋಗಿಗಳ ಸರದಿ (Queue)',
    patientChart: 'ರೋಗಿ ಚಾರ್ಟ್ (Chart)',
    clinicalRecords: 'ವೈದ್ಯಕೀಯ ದಾಖಲೆಗಳು',
    auditTrail: 'ಡಿಪಿಡಿಪಿ ಆಡಿಟ್',
    searchPlaceholder: 'ರೋಗಿಗಳು, ಆಭಾ ವಿಳಾಸ, ರೋಗಲಕ್ಷಣ ಹುಡುಕಿ...',
    available: 'ಲಭ್ಯವಿದೆ',
    inCall: 'ಕರೆಯಲ್ಲಿದ್ದಾರೆ',
    activeCall: 'ಸಕ್ರಿಯ ಕರೆ',
    signOut: 'ನಿರ್ಗಮಿಸಿ',
    clinicianStudio: 'ಕ್ಲಿನಿಕಲ್ ಸ್ಟುಡಿಯೋ',
    languageNotification: 'ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ',

    // Queue Metrics
    queueActive: 'ಸಕ್ರಿಯ ಕ್ಯೂ (Queue)',
    activeWaiting: 'ತುರ್ತು ಚಿಕಿತ್ಸೆಗೆ ಕಾಯುತ್ತಿದ್ದಾರೆ',
    scheduledToday: 'ಇಂದಿನ ಅಪಾಯಿಂಟ್ಮೆಂಟ್',
    nextIn: 'ಮುಂದಿನ ರೋಗಿ 12 ನಿಮಿಷಗಳಲ್ಲಿ',
    consentsGranted: 'ದೃಢೀಕೃತ ಸಮ್ಮತಿ',
    dpdpActiveTokens: 'ಡಿಪಿಡಿಪಿ ಸಕ್ರಿಯ ಟೋಕನ್‌ಗಳು',
    triageQueue: 'ಟ್ರಯಾಜ್ ಸರದಿ (Queue)',
    waitingTag: 'ಕಾಯುತ್ತಿದ್ದಾರೆ',
    clickToOpen: 'ಚಾರ್ಟ್ ತೆರೆಯಲು ರೋಗಿಯ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ',
    urgent: 'ತುರ್ತು',
    followUp: 'ಫಾಲೋ-ಅಪ್',
    routine: 'ಸಾಮಾನ್ಯ',
    viewChart: 'ಚಾರ್ಟ್ ವೀಕ್ಷಿಸಿ',

    // Inspector
    listenSummary: 'ಸಾರಾಂಶ ಆಲಿಸಿ',
    emergencyComplaint: 'ತೀವ್ರ ರೋಗ ಲಕ್ಷಣ',
    abdmVerified: 'ಎಬಿಡಿಎಂ ದೃಢೀಕೃತ',
    previousVisit: 'ಹಿಂದಿನ ಭೇಟಿ',
    latestVitals: 'ಇತ್ತೀಚಿನ ಪ್ರಮುಖ ಲಕ್ಷಣಗಳು',
    language: 'ಆದ್ಯತೆಯ ಭಾಷೆ',
    activeRxTitle: 'ಸಕ್ರಿಯ ಔಷಧಿಗಳು (Rx)',
    openFullChartBtn: 'ಸಂಪೂರ್ಣ ವೈದ್ಯಕೀಯ ಚಾರ್ಟ್ ತೆರೆಯಿರಿ',
    callBtn: 'ಕರೆ ಮಾಡಿ',
    startConsultationWith: 'ಸಮಾಲೋಚನೆ ಪ್ರಾರಂಭಿಸಿ:',

    // Chart Header
    backToQueue: 'ರೋಗಿಗಳ ಸರದಿ',
    comprehensiveChart: 'ಸಮಗ್ರ ವೈದ್ಯಕೀಯ ಚಾರ್ಟ್ (Full Record)',
    abdmVault: 'ದಾಖಲೆ ವಾಲ್ಟ್',
    requestConsent: 'ಸಮ್ಮತಿ ಕೋರಿಕೆ',
    startVideoCall: 'ವೀಡಿಯೊ ಕರೆ ಪ್ರಾರಂಭಿಸಿ',
    emergencyContact: 'ತುರ್ತು ಸಂಪರ್ಕ',

    // Metric Cards
    nextAppointment: 'ಮುಂದಿನ ಅಪಾಯಿಂಟ್ಮೆಂಟ್',
    lastConsultation: 'ಹಿಂದಿನ ಸಮಾಲೋಚನೆ',
    prescriptionsRx: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ (Rx)',
    active: 'ಸಕ್ರಿಯ',
    ddiSafety: '0 ಔಷಧಿ ಸಂಘರ್ಷಗಳು (Safe)',
    lastDispensed: 'ಕೊನೆಯ ವಿತರಣೆ',
    allergiesAndAlerts: 'ಅಲರ್ಜಿಗಳು ಮತ್ತು ಎಚ್ಚರಿಕೆ',
    noKnownAllergies: 'ಯಾವುದೇ ಅಲರ್ಜಿ ಇಲ್ಲ',
    nkaReported: 'ಸುರಕ್ಷಿತ (NKA)',

    // Sub-navigation Tabs
    tabOverview: 'ಅವಲೋಕನ ಮತ್ತು ವೈಟಲ್ಸ್',
    tabLastEncounter: 'ಭೇಟಿ ಟಿಪ್ಪಣಿಗಳು',
    tabPrescriptions: 'ಔಷಧಿ ಚೀಟಿಗಳು',
    tabNextAppointment: 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು',
    tabFullHistory: 'ವೈದ್ಯಕೀಯ ಇತಿಹಾಸ',

    // Vitals Section
    latestRecordedVitals: 'ದಾಖಲಾದ ಇತ್ತೀಚಿನ ಪ್ರಮುಖ ಲಕ್ಷಣಗಳು (Vitals)',
    recordedOn: 'ದಾಖಲಾದ ದಿನಾಂಕ',
    bloodPressure: 'ರಕ್ತದೊತ್ತಡ (BP)',
    heartRate: 'ಹೃದಯ ಬಡಿತ (HR)',
    temperature: 'ತಾಪಮಾನ',
    oxygenSaturation: 'ಆಮ್ಲಜನಕ (SpO2)',
    respiratoryRate: 'ಉಸಿರಾಟದ ದರ',
    bmiIndex: 'ಬಿಎಂಐ ಸೂಚ್ಯಂಕ',
    optimalRange: 'ಸಾಮಾನ್ಯ ವ್ಯಾಪ್ತಿ',
    regularRhythm: 'ನಿಯಮಿತ ಬಡಿತ',
    ambientAir: 'ಸಾಮಾನ್ಯ ಗಾಳಿ',
    activeComplaint: 'ಪ್ರಸ್ತುತ ಮುಖ್ಯ ರೋಗಲಕ್ಷಣ',
    activeDiagnoses: 'ಸಕ್ರಿಯ ರೋಗ ಲಕ್ಷಣಗಳು',
    lifestyleProfile: 'ಜೀವನಶೈಲಿ ವಿವರ',

    // SOAP Section
    clinicalEncounterNotes: 'ಕ್ಲಿನಿಕಲ್ ಸಮಾಲೋಚನೆ ಟಿಪ್ಪಣಿಗಳು (SOAP ವಿವರ)',
    subjective: 'ರೋಗಿಯ ದೂರು - Subjective (S)',
    objective: 'ದೈಹಿಕ ತಪಾಸಣೆ - Objective (O)',
    assessment: 'ರೋಗ ನಿರ್ಣಯ - Assessment (A)',
    planAdvice: 'ಚಿಕಿತ್ಸಾ ಯೋಜನೆ - Plan (P)',
    chiefComplaintLabel: 'ಮುಖ್ಯ ದೂರು:',
    hpiLabel: 'ರೋಗದ ಹಿನ್ನೆಲೆ ವಿವರ:',
    physicianImpression: 'ವೈದ್ಯರ ಕ್ಲಿನಿಕಲ್ ಅಭಿಪ್ರಾಯ:',
    clinicianInstructions: 'ವೈದ್ಯರ ನಿರ್ದೇಶನಗಳು:',
    orderedTests: 'ಆದೇಶಿಸಲಾದ ಪರೀಕ್ಷೆಗಳು:',

    // Prescriptions Section
    activeMedicalPrescriptions: 'ಸಕ್ರಿಯ ವೈದ್ಯಕೀಯ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್‌ಗಳು',
    prescriptionsSubtitle: 'ಎಬಿಡಿಎಂ ದೃಢೀಕೃತ ಔಷಧಿಗಳ ಪಟ್ಟಿ ಮತ್ತು ಸಂಘರ್ಷ ಪರಿಶೀಲನೆ',
    cdssSafetyCleared: 'ಸಿಡಿಎಸ್ಎಸ್ ಸುರಕ್ಷತಾ ತಪಾಸಣೆ ಪಾಸಾಗಿದೆ',
    morning: 'ಬೆಳಗ್ಗೆ',
    noon: 'ಮಧ್ಯಾಹ್ನ',
    night: 'ರಾತ್ರಿ',
    refillsLeft: 'ಬಾಕಿ ರೀಫಿಲ್‌ಗಳು',
    discontinuedTitle: 'ನಿಲ್ಲಿಸಲಾದ ಔಷಧಿಗಳು ಮತ್ತು ಅಡ್ಡಪರಿಣಾಮಗಳ ಇತಿಹಾಸ',

    // Next Appointment Section
    scheduledNextApt: 'ಮುಂದಿನ ನಿಗದಿತ ಅಪಾಯಿಂಟ್ಮೆಂಟ್',
    aptCalendarSubtitle: 'ಎಬಿಡಿಎಂ ಟೆಲಿಹೆಲ್ತ್ ಕನ್ಸಲ್ಟೇಶನ್ ಕ್ಯಾಲೆಂಡರ್',
    upcomingDateTitle: 'ಮುಂದಿನ ಸಮಾಲೋಚನೆ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ',
    launchEarly: 'ಸಮಾಲೋಚನೆ ಈಗಲೇ ಪ್ರಾರಂಭಿಸಿ',
    consultationMode: 'ಸಮಾಲೋಚನಾ ಮಾದರಿ',
    attendingClinician: 'ಹಾಜರಾಗುವ ವೈದ್ಯರು',
    clinicFacility: 'ಆಸ್ಪತ್ರೆ ಕೇಂದ್ರ',
    clinicalAgenda: 'ಕ್ಲಿನಿಕಲ್ ಕಾರ್ಯಸೂಚಿ ಮತ್ತು ಫಾಲೋ-ಅಪ್ ಉದ್ದೇಶಗಳು',
    patientInstructions: 'ರೋಗಿಗೆ ಪೂರ್ವ ಸಿದ್ಧತಾ ಸೂಚನೆಗಳು (WhatsApp / SMS ಮೂಲಕ ರವಾನಿಸಲಾಗಿದೆ):',

    // Vault Section
    vaultTitle: 'ಎಬಿಡಿಎಂ ಕ್ಲಿನಿಕಲ್ ರೆಕಾರ್ಡ್ಸ್ ವಾಲ್ಟ್ (ABDM Vault)',
    encryptedArtifacts: 'ಎನ್‌ಕ್ರಿಪ್ಟ್ ಮಾಡಲಾದ ಆರೋಗ್ಯ ದಾಖಲೆಗಳು:',
    requestConsentToken: 'ಸಮ್ಮತಿ ಟೋಕನ್ ವಿನಂತಿಸಿ',
    decrypted: 'ಡೀಕ್ರಿಪ್ಟ್ ಆಗಿದೆ',
    consentGated: 'ಸಮ್ಮತಿ ಅಗತ್ಯವಿದೆ',
    clinicalFindings: 'ಕ್ಲಿನಿಕಲ್ ಸಂಶೋಧನೆಗಳು',
    dpdpNote: 'ಡಿಪಿಡಿಪಿ ಭದ್ರತಾ ಟಿಪ್ಪಣಿ',
    viewScan: 'ಸ್ಕ್ಯಾನ್ ವೀಕ್ಷಿಸಿ',
    authorize: 'ಅಧಿಕಾರ ನೀಡಿ',
    done: 'ಮುಕ್ತಾಯ',

    // Reschedule
    reschedule: 'ಮರುಹೊಂದಿಸಿ',
    rescheduleAppointment: 'ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಮರುಹೊಂದಿಸಿ',
    rescheduleModalTitle: 'ರೋಗಿಯ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಮರುಹೊಂದಿಸಿ',
    rescheduleModalSubtitle: 'ಎಬಿಡಿಎಂ ವೇಳಾಪಟ್ಟಿ ನವೀಕರಿಸಿ ಮತ್ತು ರೋಗಿಯ ಮೊಬೈಲ್‌ಗೆ ರಿಯಲ್-ಟೈಮ್ ಅಧಿಸೂಚನೆ ಕಳುಹಿಸಿ',
    presetTomorrow: 'ನಾಳೆ (24 ಅಕ್ಟೋಬರ್)',
    preset3Days: '3 ದಿನಗಳಲ್ಲಿ (26 ಅಕ್ಟೋಬರ್)',
    presetNextWeek: 'ಮುಂದಿನ ವಾರ (30 ಅಕ್ಟೋಬರ್)',
    selectDate: 'ದಿನಾಂಕ',
    selectTime: 'ಸಮಯದ ಸ್ಲಾಟ್',
    rescheduleMode: 'ಸಮಾಲೋಚನಾ ವಿಧಾನ',
    rescheduleAgenda: 'ಕ್ಲಿನಿಕಲ್ ಕಾರ್ಯಸೂಚಿ ಮತ್ತು ಉದ್ದೇಶಗಳು',
    rescheduleInstructions: 'ಪೂರ್ವ-ಸಿದ್ಧತಾ ಸೂಚನೆಗಳು (SMS / App)',
    confirmReschedule: 'ದೃಢೀಕರಿಸಿ ಮತ್ತು ರೋಗಿಗೆ ಕಳುಹಿಸಿ',
    cancel: 'ರದ್ದುಮಾಡಿ',
    rescheduleSuccessNotice: 'ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಯಶಸ್ವಿಯಾಗಿ ಮರುಹೊಂದಿಸಲಾಗಿದೆ ಮತ್ತು ರೋಗಿಗೆ ರವಾನಿಸಲಾಗಿದೆ!',
  },

  hi: {
    // Header & Navigation
    patientQueue: 'मरीज़ कतार (Queue)',
    patientChart: 'मरीज़ चार्ट (Chart)',
    clinicalRecords: 'क्लिनिकल रिकॉर्ड',
    auditTrail: 'डीपीडीपी ऑडिट',
    searchPlaceholder: 'मरीज़, आभा आईडी, लक्षण खोजें...',
    available: 'उपलब्ध',
    inCall: 'कॉल में व्यस्त',
    activeCall: 'सक्रिय कॉल',
    signOut: 'लॉगआउट',
    clinicianStudio: 'चिकित्सक स्टूडियो',
    languageNotification: 'भाषा बदलकर हिंदी कर दी गई है',

    // Queue Metrics
    queueActive: 'सक्रिय कतार (Active)',
    activeWaiting: 'अति आवश्यक प्रतीक्षारत',
    scheduledToday: 'आज के अपॉइंटमेंट',
    nextIn: 'अगला मरीज़ 12 मिनट में',
    consentsGranted: 'स्वीकृत सहमति',
    dpdpActiveTokens: 'डीपीडीपी सक्रिय टोकन',
    triageQueue: 'ट्राइएज कतार (Triage)',
    waitingTag: 'प्रतीक्षारत',
    clickToOpen: 'चार्ट देखने के लिए मरीज़ पर क्लिक करें',
    urgent: 'अति आवश्यक',
    followUp: 'फॉलो-अप',
    routine: 'सामान्य',
    viewChart: 'चार्ट देखें',

    // Inspector
    listenSummary: 'सारांश सुनें',
    emergencyComplaint: 'गंभीर स्थिति',
    abdmVerified: 'एबीडीएम सत्यापित',
    previousVisit: 'पिछली भेंट',
    latestVitals: 'हालिया वाइटल्स (Vitals)',
    language: 'पसंदीदा भाषा',
    activeRxTitle: 'सक्रिय दवाइयाँ (Active Rx)',
    openFullChartBtn: 'पूरा मेडिकल चार्ट खोलें',
    callBtn: 'कॉल करें',
    startConsultationWith: 'परामर्श शुरू करें:',

    // Chart Header
    backToQueue: 'मरीज़ कतार',
    comprehensiveChart: 'व्यापक मेडिकल चार्ट (Comprehensive Chart)',
    abdmVault: 'आभा वॉल्ट',
    requestConsent: 'सहमति अनुरोध',
    startVideoCall: 'वीडियो कॉल शुरू करें',
    emergencyContact: 'आपातकालीन संपर्क',

    // Metric Cards
    nextAppointment: 'अगला अपॉइंटमेंट',
    lastConsultation: 'पिछला परामर्श',
    prescriptionsRx: 'दवा पर्ची (Rx)',
    active: 'सक्रिय',
    ddiSafety: '0 दवा पारस्परिक प्रभाव (सुरक्षित)',
    lastDispensed: 'अंतिम वितरण',
    allergiesAndAlerts: 'एलर्जी और चेतावनियाँ',
    noKnownAllergies: 'कोई ज्ञात एलर्जी नहीं',
    nkaReported: 'सुरक्षित (NKA)',

    // Sub-navigation Tabs
    tabOverview: 'अवलोकन और वाइटल्स',
    tabLastEncounter: 'परामर्श नोट्स',
    tabPrescriptions: 'दवाइयाँ और पर्ची',
    tabNextAppointment: 'अपॉइंटमेंट्स',
    tabFullHistory: 'चिकित्सा इतिहास',

    // Vitals Section
    latestRecordedVitals: 'दर्ज किए गए हालिया वाइटल्स (Vitals)',
    recordedOn: 'दर्ज दिनांक',
    bloodPressure: 'रक्तचाप (BP)',
    heartRate: 'हृदय गति (HR)',
    temperature: 'तापमान',
    oxygenSaturation: 'ऑक्सीजन (SpO2)',
    respiratoryRate: 'श्वसन दर',
    bmiIndex: 'बीएमआई इंडेक्स',
    optimalRange: 'सामान्य सीमा',
    regularRhythm: 'नियमित ताल',
    ambientAir: 'कमरे की हवा',
    activeComplaint: 'सक्रिय मुख्य लक्षण/शिकायत',
    activeDiagnoses: 'सक्रिय निदान',
    lifestyleProfile: 'सामाजिक और जीवनशैली प्रोफ़ाइल',

    // SOAP Section
    clinicalEncounterNotes: 'क्लिनिकल परामर्श नोट्स (SOAP प्रारूप)',
    subjective: 'रोगी की शिकायत - Subjective (S)',
    objective: 'शारीरिक परीक्षण - Objective (O)',
    assessment: 'रोग निदान - Assessment (A)',
    planAdvice: 'उपचार योजना - Plan (P)',
    chiefComplaintLabel: 'मुख्य शिकायत:',
    hpiLabel: 'वर्तमान बीमारी का इतिहास:',
    physicianImpression: 'चिकित्सक की नैदानिक राय:',
    clinicianInstructions: 'चिकित्सक के निर्देश:',
    orderedTests: 'जांच के आदेश:',

    // Prescriptions Section
    activeMedicalPrescriptions: 'सक्रिय मेडिकल पर्ची (Rx)',
    prescriptionsSubtitle: 'एबीडीएम सत्यापित दवाइयां और एलर्जी सुरक्षा जांच',
    cdssSafetyCleared: 'सीडीएसएस सुरक्षा स्वीकृत',
    morning: 'सुबह',
    noon: 'दोपहर',
    night: 'रात',
    refillsLeft: 'शेष रिफिल',
    discontinuedTitle: 'बंद की गई दवाइयां और प्रतिकूल प्रभाव का इतिहास',

    // Next Appointment Section
    scheduledNextApt: 'आगामी निर्धारित अपॉइंटमेंट',
    aptCalendarSubtitle: 'एबीडीएम टेलीहेल्थ परामर्श कैलेंडर',
    upcomingDateTitle: 'आगामी परामर्श दिनांक और समय',
    launchEarly: 'परामर्श अभी शुरू करें',
    consultationMode: 'परामर्श माध्यम',
    attendingClinician: 'उपस्थित चिकित्सक',
    clinicFacility: 'अस्पताल केंद्र',
    clinicalAgenda: 'नैदानिक एजेंडा और उद्देश्य',
    patientInstructions: 'मरीज़ के लिए तैयारी निर्देश (WhatsApp / SMS द्वारा भेजे गए):',

    // Vault Section
    vaultTitle: 'एबीडीएम क्लिनिकल रिकॉर्ड्स वॉल्ट',
    encryptedArtifacts: 'एन्क्रिप्टेड स्वास्थ्य रिकॉर्ड:',
    requestConsentToken: 'सहमति टोकन का अनुरोध करें',
    decrypted: 'डिक्रिप्टेड',
    consentGated: 'सहमति आवश्यक',
    clinicalFindings: 'क्लिनिकल निष्कर्ष',
    dpdpNote: 'डीपीडीपी सुरक्षा नोट',
    viewScan: 'स्कैन देखें',
    authorize: 'अधिकृत करें',
    done: 'संपन्न',

    // Reschedule
    reschedule: 'पुनर्निर्धारित करें',
    rescheduleAppointment: 'अपॉइंटमेंट पुनर्निर्धारित करें',
    rescheduleModalTitle: 'मरीज़ का अपॉइंटमेंट पुनर्निर्धारित करें',
    rescheduleModalSubtitle: 'एबीडीएम शेड्यूल अपडेट करें और मरीज़ के ऐप पर तुरंत सूचना भेजें',
    presetTomorrow: 'कल (24 अक्टूबर)',
    preset3Days: '3 दिनों में (26 अक्टूबर)',
    presetNextWeek: 'अगले सप्ताह (30 अक्टूबर)',
    selectDate: 'दिनांक',
    selectTime: 'समय स्लॉट',
    rescheduleMode: 'परामर्श माध्यम',
    rescheduleAgenda: 'क्लिनिकल एजेंडा और उद्देश्य',
    rescheduleInstructions: 'पूर्व-तैयारी निर्देश (SMS / App)',
    confirmReschedule: 'पुष्टि करें और मरीज़ को भेजें',
    cancel: 'रद्द करें',
    rescheduleSuccessNotice: 'अपॉइंटमेंट सफलतापूर्वक पुनर्निर्धारित कर मरीज़ को भेज दिया गया!',
  },
};

export function t(lang: SupportedLanguage, key: string): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en']?.[key] || key;
}

export const DOCTOR_LANGUAGE_STORAGE_KEY = 'swasthyasetu.doctor.language';
export const DEFAULT_DOCTOR_LANGUAGE: SupportedLanguage = 'en';

/**
 * Returns saved language from localStorage if explicitly chosen by user, else 'en'.
 */
export function getInitialDoctorLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_DOCTOR_LANGUAGE;
  try {
    const saved = localStorage.getItem(DOCTOR_LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'kn' || saved === 'hi') {
      return saved;
    }
  } catch {
    // localStorage disabled or not accessible
  }
  return DEFAULT_DOCTOR_LANGUAGE;
}

/**
 * Persists user's explicit language selection to localStorage.
 */
export function saveDoctorLanguage(lang: SupportedLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DOCTOR_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // localStorage disabled or not accessible
  }
}

/**
 * Strips parenthesised non-Latin/Indic translations in English mode.
 * e.g. "Fever (ಜ್ವರ / बुखार)." becomes "Fever.", and "Ramesh Gowda (ರಮೇಶ್ ಗೌಡ)" becomes "Ramesh Gowda".
 */
export const NON_LATIN_PAREN_REGEX = /\s*\((?=[^()]*[\u0C80-\u0CFF\u0900-\u097F])[^()]*\)/g;

export function stripNonLatinParentheses(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(NON_LATIN_PAREN_REGEX, '').trim();
}

/**
 * Display-layer helper for text at render points.
 * In English mode only, strips parenthesised non-Latin translations.
 * Kannada and Hindi modes are unchanged and extract their respective script.
 */
export function displayLocalized(text: string | undefined | null, lang: SupportedLanguage): string {
  if (!text) return '';
  if (lang === 'en') {
    return stripNonLatinParentheses(text);
  }
  return localized(text, lang);
}

/**
 * Formats a name showing only the active language, removing dual script duplication e.g. "Ramesh Gowda (ರಮೇಶ್ ಗೌಡ)".
 */
export function formatLocalizedName(fullName: string | undefined | null, lang: SupportedLanguage): string {
  return displayLocalized(fullName, lang);
}

/**
 * Formats complaint text showing only the active language, stripping dual language notes if bracketed.
 */
export function formatLocalizedComplaint(complaint: string | undefined | null, lang: SupportedLanguage): string {
  return displayLocalized(complaint, lang);
}

/**
 * Display-layer helper: in English mode, shows only the English part of bilingual strings
 * like "Fever (ಜ್ವರ / बुखार)". In Indic modes, extracts the appropriate Indic script option.
 */
export function localized(value: string | undefined | null, lang: SupportedLanguage): string {
  if (!value) return '';
  if (lang === 'en') {
    return stripNonLatinParentheses(value);
  }

  const match = value.match(/^([^()]+)\s*\(([^()]+)\)/);
  if (!match) return value.trim();

  const englishPart = match[1].trim();
  const bracketPart = match[2].trim();

  const isKannada = (s: string) => /[\u0C80-\u0CFF]/.test(s);
  const isHindi = (s: string) => /[\u0900-\u097F]/.test(s);

  const options = bracketPart.split('/').map((s) => s.trim());
  if (lang === 'kn') {
    const kn = options.find(isKannada);
    if (kn) return kn;
    if (isKannada(englishPart)) return englishPart;
  } else if (lang === 'hi') {
    const hi = options.find(isHindi);
    if (hi) return hi;
    if (isHindi(englishPart)) return englishPart;
  }

  return englishPart;
}

