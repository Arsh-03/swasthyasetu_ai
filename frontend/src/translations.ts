export interface TranslationDict {
  brandTitle: string;
  brandTagline: string;
  rolePatient: string;
  roleDoctor: string;
  netGood: string;
  netWeak: string;
  netBad: string;
  netTierLabel: string;
  auditLogsBtn: string;

  // Tabs for Patient & Doctor
  tabConsultation: string;
  tabRecords: string;
  tabPrescriptions: string;
  tabProfile: string;
  tabTriage: string;
  tabDoctorRecords: string;
  tabScribe: string;
  tabFhir: string;

  // Patient View
  patientCardTitle: string;
  listenAudioBtn: string;
  nameLabel: string;
  abhaLabel: string;
  districtLabel: string;
  participantQuestion: string;
  patientSelf: string;
  authRepresentative: string;
  repDisclaimer: string;

  // Telehealth
  liveConsultationWith: string;
  audioOnlyTitle: string;
  audioOnlySub: string;
  storeAndForwardTitle: string;
  storeAndForwardSub: string;
  sendMsgBtn: string;
  msgPlaceholder: string;
  youPip: string;

  // Records
  recordsTitle: string;
  recordsSub: string;
  protectedBadge: string;
  approvedBadge: string;
  expiredBadge: string;
  simulateRequestBtn: string;
  revokeAccessBtn: string;

  // Consent Modal
  modalTitle: string;
  modalHeaderNotice: string;
  recordLabel: string;
  purposeLabel: string;
  durationLabel: string;
  scopeLabel: string;
  dpdpDisclaimer: string;
  declineBtn: string;
  approveBtn: string;

  // Discharge Plan
  dischargeTitle: string;
  diagnosisLabel: string;
  prescriptionsLabel: string;
  dietaryLabel: string;
  redFlagsLabel: string;
  followupPrompt: string;
  feelingBetter: string;
  noChange: string;
  needHelp: string;

  // Speech synthesis strings
  welcomeAudioText: string;
  consentAudioText: string;
  dischargeAudioText: string;
}

export const translations: Record<'en' | 'kn' | 'hi', TranslationDict> = {
  kn: {
    brandTitle: "ಕೇರ್‌ಬ್ರಿಡ್ಜ್ ಇಂಡಿಯಾ (CareBridge)",
    brandTagline: "ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಡಿಜಿಟಲ್ ಮಿಷನ್ (ABDM) ಟೆಲಿಮೆಡಿಸಿನ್ ಒಪ್ಪಿಗೆ ವ್ಯವಸ್ಥೆ",
    rolePatient: "ರೋಗಿಯ ವೀಕ್ಷಣೆ (Patient)",
    roleDoctor: "ವೈದ್ಯರ ವೀಕ್ಷಣೆ (Doctor)",
    netGood: "🟢 ಉತ್ತಮ ನೆಟ್‌ವರ್ಕ್ (HD Video)",
    netWeak: "🟡 ದುರ್ಬಲ ನೆಟ್‌ವರ್ಕ್ (ಆಡಿಯೊ ಆದ್ಯತೆ)",
    netBad: "🔴 ಕಳಪೆ ನೆಟ್‌ವರ್ಕ್ (ಆಫ್‌ಲೈನ್ ಸಂದೇಶ)",
    netTierLabel: "ನೆಟ್‌ವರ್ಕ್ ಸ್ಥಿತಿ:",
    auditLogsBtn: "📋 DPDP ಆಡಿಟ್ ಲಾಗ್ಸ್",

    tabConsultation: "📹 ಲೈವ್ ಸಮಾಲೋಚನೆ",
    tabRecords: "📁 ABHA ದಾಖಲೆಗಳು & ಒಪ್ಪಿಗೆ",
    tabPrescriptions: "💊 ಔಷಧಿಗಳು & ಚಿಕಿತ್ಸಾ ವಿವರ",
    tabProfile: "👤 ರೋಗಿಯ ಪ್ರೊಫೈಲ್",
    tabTriage: "🩺 ರೋಗಿ ವಿವರ & ಪರೀಕ್ಷೆ",
    tabDoctorRecords: "🔐 ರಕ್ಷಿತ ದಾಖಲೆಗಳು (Vault)",
    tabScribe: "🤖 AI ಸ್ಕ್ರೈಬ್ & CDSS",
    tabFhir: "📄 FHIR R4 ಕಡತ & ನಿಯಮಾವಳಿ",

    patientCardTitle: "ರೋಗಿಯ ವಿವರ ಮತ್ತು ಗುರುತು",
    listenAudioBtn: "🔊 ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಿ",
    nameLabel: "ರೋಗಿಯ ಹೆಸರು:",
    abhaLabel: "ABHA ವಿಳಾಸ:",
    districtLabel: "ಜಿಲ್ಲೆ:",
    participantQuestion: "ಸಮಾಲೋಚನೆಯಲ್ಲಿ ಯಾರು ಭಾಗವಹಿಸುತ್ತಿದ್ದಾರೆ?",
    patientSelf: "ನಾನೇ ರೋಗಿ",
    authRepresentative: "ಅಧಿಕೃತ ಪ್ರತಿನಿಧಿ",
    repDisclaimer: "ಪ್ರತಿನಿಧಿಯ ಮಾಹಿತಿ: ಸುನೀತಾ ದೇವಿ (ಸೊಸೆ) · ಅಧಿಕಾರ ಪತ್ರ ದೃಢೀಕರಿಸಲಾಗಿದೆ (DPDP ಕಾಯ್ದೆ ಮಾನ್ಯತೆ).",

    liveConsultationWith: "ಡಾ. ಅನನ್ಯಾ ಶರ್ಮಾ ಅವರೊಂದಿಗೆ ಲೈವ್ ಸಮಾಲೋಚನೆ",
    audioOnlyTitle: "ಧ್ವನಿ-ಮಾತ್ರ ಸಮಾಲೋಚನೆ (Audio Priority Mode)",
    audioOnlySub: "ನೆಟ್‌ವರ್ಕ್ ಕಡಿಮೆ ಇರುವುದರಿಂದ ಧ್ವನಿಯ ಸ್ಪಷ್ಟತೆಗಾಗಿ ವೀಡಿಯೊ ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ.",
    storeAndForwardTitle: "ನೆಟ್‌ವರ್ಕ್ ಸಂಪರ್ಕ ಕಡಿತಗೊಂಡಿದೆ (Store-and-Forward)",
    storeAndForwardSub: "ಆಫ್‌ಲೈನ್ ಸಂದೇಶ ವ್ಯವಸ್ಥೆಗೆ ಬದಲಾಯಿಸಲಾಗಿದೆ. ನೆಟ್‌ವರ್ಕ್ ಬಂದ ತಕ್ಷಣ ಸಂದೇಶ ರವಾನೆಯಾಗುತ್ತದೆ.",
    sendMsgBtn: "ಕಳುಹಿಸಿ",
    msgPlaceholder: "ನಿಮ್ಮ ಲಕ್ಷಣಗಳನ್ನು ಇಲ್ಲಿ ಬರೆಯಿರಿ...",
    youPip: "ರಮೇಶ್ (ನೀವು)",

    recordsTitle: "ನನ್ನ ಸುರಕ್ಷಿತ ವೈದ್ಯಕೀಯ ದಾಖಲೆಗಳು",
    recordsSub: "ನಿಮ್ಮ ಸ್ಪಷ್ಟ ಅನುಮತಿಯಿಲ್ಲದೆ ವೈದ್ಯರು ಯಾವುದೇ ದಾಖಲೆಯನ್ನು ನೋಡಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    protectedBadge: "🔒 ರಕ್ಷಿಸಲಾಗಿದೆ",
    approvedBadge: "🔓 ಅನುಮೋದಿಸಲಾಗಿದೆ (60 ನಿಮಿಷ)",
    expiredBadge: "⏳ ಅವಧಿ ಮುಗಿದಿದೆ",
    simulateRequestBtn: "⚡ [ಡೆಮೊ]: ವೈದ್ಯರಿಂದ ಸ್ಕ್ಯಾನ್ ಅನುಮತಿ ಕೋರಿಕೆಯನ್ನು ಪರೀಕ್ಷಿಸಿ",
    revokeAccessBtn: "🚫 1-ಕ್ಲಿಕ್ ಅನುಮತಿ ರದ್ದುಮಾಡಿ (Revoke)",

    modalTitle: "ದಾಖಲೆ ಪ್ರವೇಶ ಅನುಮತಿ ಕೋರಿಕೆ",
    modalHeaderNotice: "ಡಾ. ಅನನ್ಯಾ ಶರ್ಮಾ (NMC Reg: #581920) ಅವರು ನಿಮ್ಮ ಈ ಕೆಳಗಿನ ದಾಖಲೆಯನ್ನು ನೋಡಲು ಅನುಮತಿ ಕೋರುತ್ತಿದ್ದಾರೆ:",
    recordLabel: "ದಾಖಲೆ:",
    purposeLabel: "ವೈದ್ಯಕೀಯ ಉದ್ದೇಶ:",
    durationLabel: "ಅನುಮತಿ ಕಾಲಾವಧಿ:",
    scopeLabel: "ವ್ಯಾಪ್ತಿ:",
    dpdpDisclaimer: "* ಭಾರತ ಸರ್ಕಾರದ DPDP ಕಾಯ್ದೆ 2023 ಅಡಿಯಲ್ಲಿ, ನೀವು ಯಾವುದೇ ಕ್ಷಣದಲ್ಲಿ ಈ ಅನುಮತಿಯನ್ನು ಹಿಂಪಡೆಯಬಹುದು.",
    declineBtn: "❌ ತಿರಸ್ಕರಿಸಿ",
    approveBtn: "✅ ಅನುಮೋದಿಸಿ",

    dischargeTitle: "ವೈದ್ಯರ ಸಲಹಾ ಪತ್ರ ಮತ್ತು ಚಿಕಿತ್ಸಾ ಯೋಜನೆ",
    diagnosisLabel: "ರೋಗ ನಿರ್ಣಯ:",
    prescriptionsLabel: "ಸೂಚಿಸಲಾದ ಔಷಧಗಳು:",
    dietaryLabel: "ಆಹಾರ ಮತ್ತು ನೀರು ಕುಡಿಯುವ ನಿಯಮಗಳು:",
    redFlagsLabel: "ತುರ್ತು ಎಚ್ಚರಿಕೆ ಲಕ್ಷಣಗಳು (Red Flags):",
    followupPrompt: "48 ಗಂಟೆಗಳ ನಂತರದ ನಿಮ್ಮ ಆರೋಗ್ಯ ಸ್ಥಿತಿ ಹೇಗಿದೆ?",
    feelingBetter: "ಗುಣಮುಖವಾಗಿದ್ದೇನೆ 😊",
    noChange: "ಬದಲಾವಣೆ ಇಲ್ಲ 😐",
    needHelp: "ತಕ್ಷಣ ಸಹಾಯ ಬೇಕು 🚨",

    welcomeAudioText: "ನಮಸ್ಕಾರ ರಮೇಶ್ ಅವರೇ. ಕೇರ್‌ಬ್ರಿಡ್ಜ್‌ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ದಾಖಲೆಗಳು ನಿಮ್ಮ ನಿಯಂತ್ರಣದಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿವೆ.",
    consentAudioText: "ಡಾಕ್ಟರ್ ಅನನ್ಯಾ ಶರ್ಮಾ ಅವರು ನಿಮ್ಮ ಹೊಟ್ಟೆ ನೋವಿನ ತಪಾಸಣೆಗಾಗಿ ನಿಮ್ಮ ಅಲ್ಟ್ರಾಸೌಂಡ್ ಸ್ಕ್ಯಾನ್ ವರದಿಯನ್ನು 60 ನಿಮಿಷಗಳ ಕಾಲ ವೀಕ್ಷಿಸಲು ಅನುಮತಿ ಕೇಳುತ್ತಿದ್ದಾರೆ. ಅನುಮೋದಿಸಲು ಹಸಿರು ಬಟನ್ ಒತ್ತಿ.",
    dischargeAudioText: "ಡಾಕ್ಟರ್ ಅನನ್ಯಾ ಶರ್ಮಾ ಅವರು ನೀಡಿರುವ ಚಿಕಿತ್ಸಾ ಪತ್ರ: ದಿನಕ್ಕೆ ಮೂರು ಲೀಟರ್ ನೀರು ಕುಡಿಯಿರಿ. ಟ್ಯಾಮ್ಸುಲೋಸಿನ್ ರಾತ್ರಿ ಮಲಗುವಾಗ ತೆಗೆದುಕೊಳ್ಳಿ. ವಿಪರೀತ ಜ್ವರ ಬಂದರೆ ತಕ್ಷಣ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ."
  },

  hi: {
    brandTitle: "केयरब्रिज इंडिया (CareBridge)",
    brandTagline: "आयुष्मान भारत डिजिटल मिशन (ABDM) टेलीमेडिसिन सहमति प्रणाली",
    rolePatient: "रोगी दृश्य (Patient)",
    roleDoctor: "डॉक्टर दृश्य (Doctor)",
    netGood: "🟢 अच्छा नेटवर्क (HD Video)",
    netWeak: "🟡 कमजोर नेटवर्क (ऑडियो प्राथमिकता)",
    netBad: "🔴 खराब नेटवर्क (स्टोर और फॉरवर्ड)",
    netTierLabel: "नेटवर्क स्थिति:",
    auditLogsBtn: "📋 DPDP ऑडिट लॉग",

    tabConsultation: "📹 लाइव परामर्श",
    tabRecords: "📁 ABHA रिकॉर्ड्स एवं सहमति",
    tabPrescriptions: "💊 दवाइयां एवं उपचार योजना",
    tabProfile: "👤 मरीज़ प्रोफ़ाइल",
    tabTriage: "🩺 मरीज़ परीक्षण एवं सारांश",
    tabDoctorRecords: "🔐 संरक्षित रिकॉर्ड्स (Vault)",
    tabScribe: "🤖 AI स्क्राइब एवं CDSS",
    tabFhir: "📄 FHIR R4 एवं अनुपालन",

    patientCardTitle: "रोगी विवरण एवं पहचान",
    listenAudioBtn: "🔊 आवाज में सुनें",
    nameLabel: "रोगी का नाम:",
    abhaLabel: "ABHA पता:",
    districtLabel: "जिला:",
    participantQuestion: "परामर्श में कौन भाग ले रहा है?",
    patientSelf: "मैं स्वयं रोगी हूँ",
    authRepresentative: "अधिकृत प्रतिनिधि",
    repDisclaimer: "प्रतिनिधि विवरण: सुनीता देवी (पुत्रवधू / बहु) · कानूनी प्राधिकार सत्यापित (DPDP अधिनियम)।",

    liveConsultationWith: "डॉ. अनन्या शर्मा के साथ लाइव परामर्श",
    audioOnlyTitle: "ऑडियो-प्राथमिकता परामर्श (Audio Priority Mode)",
    audioOnlySub: "कमजोर नेटवर्क के कारण आवाज की स्पष्टता बनाए रखने हेतु वीडियो बंद किया गया है।",
    storeAndForwardTitle: "नेटवर्क संपर्क टूटा (Store-and-Forward)",
    storeAndForwardSub: "ऑफ़लाइन संदेश मोड सक्रिय। नेटवर्क बहाल होते ही संदेश डॉक्टर को मिल जाएगा।",
    sendMsgBtn: "भेजें",
    msgPlaceholder: "अपने लक्षण यहाँ लिखें...",
    youPip: "रमेश (आप)",

    recordsTitle: "मेरे सुरक्षित स्वास्थ्य रिकॉर्ड",
    recordsSub: "आपकी स्पष्ट अनुमति के बिना डॉक्टर कोई भी रिपोर्ट नहीं देख सकते।",
    protectedBadge: "🔒 सुरक्षित",
    approvedBadge: "🔓 स्वीकृत (60 मिनट)",
    expiredBadge: "⏳ समय समाप्त",
    simulateRequestBtn: "⚡ [डेमो]: डॉक्टर से स्कैन अनुमति अनुरोध का परीक्षण करें",
    revokeAccessBtn: "🚫 1-क्लिक अनुमति रद्द करें (Revoke)",

    modalTitle: "रिकॉर्ड एक्सेस अनुमति अनुरोध",
    modalHeaderNotice: "डॉ. अनन्या शर्मा (NMC Reg: #581920) आपके निम्नलिखित मेडिकल रिकॉर्ड को देखने की अनुमति मांग रही हैं:",
    recordLabel: "रिकॉर्ड:",
    purposeLabel: "नैदानिक उद्देश्य:",
    durationLabel: "सहमति अवधि:",
    scopeLabel: "दायरा:",
    dpdpDisclaimer: "* DPDP अधिनियम 2023 के तहत, आप किसी भी समय इस अनुमति को तुरंत वापस ले सकते हैं।",
    declineBtn: "❌ अस्वीकार करें",
    approveBtn: "✅ स्वीकार करें",

    dischargeTitle: "डिस्चार्ज सारांश एवं उपचार योजना",
    diagnosisLabel: "निदान (Diagnosis):",
    prescriptionsLabel: "निर्धारित दवाइयां:",
    dietaryLabel: "आहार एवं तरल पदार्थ सलाह:",
    redFlagsLabel: "आपातकालीन चेतावनी संकेत (Red Flags):",
    followupPrompt: "48 घंटे बाद आपकी तबीयत कैसी है?",
    feelingBetter: "बेहतर महसूस हो रहा है 😊",
    noChange: "कोई बदलाव नहीं 😐",
    needHelp: "तत्काल मदद चाहिए 🚨",

    welcomeAudioText: "नमस्ते रमेश जी। केयरब्रिज में आपका स्वागत है। आपके स्वास्थ्य रिकॉर्ड आपकी अनुमति के बिना साझा नहीं किए जाएंगे।",
    consentAudioText: "डॉक्टर अनन्या शर्मा ने पेट दर्द की जांच के लिए आपकी अल्ट्रासाउंड रिपोर्ट को 60 मिनट के लिए देखने की अनुमति मांगी है। स्वीकार करने के लिए हरा बटन दबाएं।",
    dischargeAudioText: "डॉक्टर अनन्या शर्मा की सलाह: प्रतिदिन तीन लीटर पानी पिएं। टैमसुलोसिन रात को सोते समय लें। यदि तेज बुखार आए तो तुरंत नजदीकी अस्पताल जाएं।"
  },

  en: {
    brandTitle: "CareBridge India",
    brandTagline: "ABDM Telemedicine Consent & Clinical Decision Layer",
    rolePatient: "Patient Portal",
    roleDoctor: "Physician Console",
    netGood: "🟢 HD Video (450 kbps)",
    netWeak: "🟡 Audio Priority (50 kbps)",
    netBad: "🔴 Store & Forward (<20 kbps)",
    netTierLabel: "Network State:",
    auditLogsBtn: "📋 DPDP Audit Trail",

    tabConsultation: "📹 Live Consultation",
    tabRecords: "📁 ABHA Records & Consent",
    tabPrescriptions: "💊 Prescriptions & Care Plan",
    tabProfile: "👤 Patient Profile & Authority",
    tabTriage: "🩺 Patient Triage & Vitals",
    tabDoctorRecords: "🔐 Protected Records (Vault)",
    tabScribe: "🤖 AI Scribe & CDSS Gate",
    tabFhir: "📄 HL7 FHIR R4 & Compliance",

    patientCardTitle: "Patient Identity & ABHA Verification",
    listenAudioBtn: "🔊 Listen to Guidance",
    nameLabel: "Patient Name:",
    abhaLabel: "ABHA Address:",
    districtLabel: "District:",
    participantQuestion: "Who is participating in this teleconsultation?",
    patientSelf: "I am the patient",
    authRepresentative: "Authorised Representative",
    repDisclaimer: "Representative Identified: Sunita Devi (Daughter-in-law) · Power of Authority Verified under DPDP Act 2023.",

    liveConsultationWith: "Live Consultation with Dr. Ananya Sharma",
    audioOnlyTitle: "Audio Priority Consultation Mode",
    audioOnlySub: "Video disabled automatically to maintain crystal-clear audio packets over weak cellular link.",
    storeAndForwardTitle: "Connection Severed (Store-and-Forward)",
    storeAndForwardSub: "Switched to asynchronous message queue. Messages will sync automatically upon reconnection.",
    sendMsgBtn: "Send Note",
    msgPlaceholder: "Describe current symptoms...",
    youPip: "Ramesh (You)",

    recordsTitle: "My ABDM Protected Health Records",
    recordsSub: "Doctors cannot access any diagnostic report without your explicit, purpose-scoped consent.",
    protectedBadge: "🔒 Protected",
    approvedBadge: "🔓 Granted (60m Token)",
    expiredBadge: "⏳ Expired",
    simulateRequestBtn: "⚡ [Demo Test]: Simulate Doctor Requesting Ultrasound Scan",
    revokeAccessBtn: "🚫 1-Click Revoke Access Immediately",

    modalTitle: "Purpose-Specific Record Access Request",
    modalHeaderNotice: "Dr. Ananya Sharma (NMC Reg: #581920) is requesting temporary access to your diagnostic scan:",
    recordLabel: "Requested Record:",
    purposeLabel: "Clinical Purpose:",
    durationLabel: "Access Duration:",
    scopeLabel: "Access Scope:",
    dpdpDisclaimer: "* Under the Digital Personal Data Protection (DPDP) Act 2023, you retain the legal right to revoke this consent at any time.",
    declineBtn: "❌ Decline Access",
    approveBtn: "✅ Grant Purpose Access",

    dischargeTitle: "Discharge Summary & Care Plan",
    diagnosisLabel: "Diagnosis:",
    prescriptionsLabel: "Prescribed Medications:",
    dietaryLabel: "Hydration & Diet Guidelines:",
    redFlagsLabel: "Critical Red Flags:",
    followupPrompt: "48-Hour Follow-Up: How are you feeling today?",
    feelingBetter: "Feeling Better 😊",
    noChange: "No Change 😐",
    needHelp: "Need Urgent Help 🚨",

    welcomeAudioText: "Welcome Ramesh Gowda to CareBridge India. Your medical records remain strictly under your personal control.",
    consentAudioText: "Dr. Ananya Sharma requests temporary access to your Ultrasound Scan to assess acute abdominal pain for 60 minutes. Click the green button to approve.",
    dischargeAudioText: "Discharge care plan from Dr. Ananya Sharma: Drink 3 liters of water daily. Take Tamsulosin at bedtime. Seek immediate emergency care if high fever or inability to pass urine develops."
  }
};
