// GENERATED COPY of shared/call/consentText.ts. Do not edit here: edit shared/call/consentText.ts,
// then run `node scripts/sync-call-engine.mjs`.

// Patient consent text for AI minutes, written out in full (not machine-translated).
// Kannada and Hindi versions should be reviewed by a native speaker before production use.
import type { CallLanguage as Language } from './callTypes';

export interface ConsentCopy {
  heading: string;
  title: (doctor: string) => string;
  points: { label: string; text: string }[];
  allow: string;
  deny: string;
  stop: string;
  recordingBanner: string;
}

export const CONSENT_TEXT: Record<Language, ConsentCopy> = {
  en: {
    heading: 'Permission to record audio for AI minutes',
    title: (doctor) => `${doctor} would like to use AI minutes for this consultation`,
    points: [
      { label: 'What is recorded', text: 'Only the audio (voices) of this call. Video is never recorded.' },
      { label: 'How', text: "While this option is on, your voice and the doctor's voice are recorded separately, in short parts (on a phone, your voice is captured by the doctor's app from this call)." },
      { label: 'Why', text: 'To write the minutes of the consultation and check that nothing you said is missing from your medical notes. The doctor reviews everything before it becomes part of your record.' },
      { label: 'Your privacy', text: 'Before any AI processing, your name, phone number, ABHA ID, address and other personal details are removed and replaced with anonymous labels. The AI only sees the medical discussion (symptoms, history, diagnosis, advice) and never knows who you are.' },
      { label: 'Your data stays with CareBridge', text: "Processing happens only on CareBridge's own secure servers. None of your personal data is shared with any outside company." },
      { label: 'Deleted after use', text: 'The audio is deleted as soon as it has been converted to text. Only the doctor’s notes are kept in your record.' },
      { label: 'Your choice', text: 'You can say no and the consultation continues normally. You can stop the recording at any time with the "Stop recording" button.' },
    ],
    allow: 'Allow recording',
    deny: "Don't allow",
    stop: 'Stop recording',
    recordingBanner: 'Audio is being recorded for AI minutes. Your name and personal details are removed before any AI processing.',
  },
  hi: {
    heading: 'AI सारांश के लिए ऑडियो रिकॉर्ड करने की अनुमति',
    title: (doctor) => `${doctor} इस परामर्श के लिए AI सारांश (मिनट्स) का उपयोग करना चाहते हैं`,
    points: [
      { label: 'क्या रिकॉर्ड होगा', text: 'इस कॉल की केवल आवाज़ (ऑडियो)। वीडियो कभी रिकॉर्ड नहीं होता।' },
      { label: 'कैसे', text: 'जब तक यह विकल्प चालू है, आपकी और डॉक्टर की आवाज़ अलग-अलग, छोटे हिस्सों में रिकॉर्ड की जाती है (फ़ोन पर, आपकी आवाज़ इस कॉल से डॉक्टर के ऐप द्वारा रिकॉर्ड होती है)।' },
      { label: 'किस लिए', text: 'परामर्श का सारांश बनाने और यह जाँचने के लिए कि आपकी कही कोई बात आपके मेडिकल नोट्स में छूट न जाए। आपके रिकॉर्ड में जुड़ने से पहले डॉक्टर सब कुछ जाँचते हैं।' },
      { label: 'आपकी गोपनीयता', text: 'AI के किसी भी उपयोग से पहले आपका नाम, फ़ोन नंबर, ABHA ID, पता और अन्य निजी जानकारी हटा दी जाती है और उसकी जगह गुमनाम लेबल लगा दिए जाते हैं। AI केवल चिकित्सा बातचीत (लक्षण, इतिहास, निदान, सलाह) देखता है और कभी नहीं जानता कि आप कौन हैं।' },
      { label: 'आपका डेटा CareBridge के पास ही रहता है', text: 'सारी प्रक्रिया केवल CareBridge के अपने सुरक्षित सर्वर पर होती है। आपकी कोई भी निजी जानकारी किसी बाहरी कंपनी के साथ साझा नहीं की जाती।' },
      { label: 'उपयोग के बाद हटा दिया जाता है', text: 'ऑडियो को टेक्स्ट में बदलते ही हटा दिया जाता है। आपके रिकॉर्ड में केवल डॉक्टर के नोट्स रहते हैं।' },
      { label: 'आपकी मर्ज़ी', text: 'आप मना कर सकते हैं, परामर्श सामान्य रूप से जारी रहेगा। आप कभी भी "रिकॉर्डिंग रोकें" बटन से रिकॉर्डिंग बंद कर सकते हैं।' },
    ],
    allow: 'रिकॉर्डिंग की अनुमति दें',
    deny: 'अनुमति न दें',
    stop: 'रिकॉर्डिंग रोकें',
    recordingBanner: 'AI सारांश के लिए ऑडियो रिकॉर्ड हो रहा है। AI उपयोग से पहले आपका नाम और निजी जानकारी हटा दी जाती है।',
  },
  kn: {
    heading: 'AI ಸಾರಾಂಶಕ್ಕಾಗಿ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಲು ಅನುಮತಿ',
    title: (doctor) => `${doctor} ಈ ಸಮಾಲೋಚನೆಗೆ AI ಸಾರಾಂಶ (ಮಿನಿಟ್ಸ್) ಬಳಸಲು ಬಯಸುತ್ತಾರೆ`,
    points: [
      { label: 'ಏನು ರೆಕಾರ್ಡ್ ಆಗುತ್ತದೆ', text: 'ಈ ಕರೆಯ ಧ್ವನಿ (ಆಡಿಯೋ) ಮಾತ್ರ. ವೀಡಿಯೋವನ್ನು ಎಂದಿಗೂ ರೆಕಾರ್ಡ್ ಮಾಡುವುದಿಲ್ಲ.' },
      { label: 'ಹೇಗೆ', text: 'ಈ ಆಯ್ಕೆ ಆನ್ ಇರುವವರೆಗೆ, ನಿಮ್ಮ ಮತ್ತು ವೈದ್ಯರ ಧ್ವನಿಯನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ, ಸಣ್ಣ ಭಾಗಗಳಲ್ಲಿ ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗುತ್ತದೆ (ಫೋನ್‌ನಲ್ಲಿ, ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಈ ಕರೆಯಿಂದ ವೈದ್ಯರ ಆ್ಯಪ್ ರೆಕಾರ್ಡ್ ಮಾಡುತ್ತದೆ).' },
      { label: 'ಯಾವುದಕ್ಕಾಗಿ', text: 'ಸಮಾಲೋಚನೆಯ ಸಾರಾಂಶ ಬರೆಯಲು ಮತ್ತು ನೀವು ಹೇಳಿದ ಯಾವುದೇ ವಿಷಯ ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ಟಿಪ್ಪಣಿಗಳಲ್ಲಿ ಬಿಟ್ಟುಹೋಗಿಲ್ಲ ಎಂದು ಪರಿಶೀಲಿಸಲು. ನಿಮ್ಮ ದಾಖಲೆಗೆ ಸೇರುವ ಮೊದಲು ವೈದ್ಯರು ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸುತ್ತಾರೆ.' },
      { label: 'ನಿಮ್ಮ ಗೌಪ್ಯತೆ', text: 'AI ಬಳಕೆಯ ಮೊದಲು ನಿಮ್ಮ ಹೆಸರು, ಫೋನ್ ಸಂಖ್ಯೆ, ABHA ID, ವಿಳಾಸ ಮತ್ತು ಇತರ ವೈಯಕ್ತಿಕ ವಿವರಗಳನ್ನು ತೆಗೆದುಹಾಕಿ, ಅನಾಮಧೇಯ ಗುರುತುಗಳನ್ನು ಹಾಕಲಾಗುತ್ತದೆ. AI ವೈದ್ಯಕೀಯ ಚರ್ಚೆಯನ್ನು (ಲಕ್ಷಣಗಳು, ಇತಿಹಾಸ, ರೋಗನಿರ್ಣಯ, ಸಲಹೆ) ಮಾತ್ರ ನೋಡುತ್ತದೆ; ನೀವು ಯಾರು ಎಂದು ಅದಕ್ಕೆ ಎಂದಿಗೂ ತಿಳಿಯುವುದಿಲ್ಲ.' },
      { label: 'ನಿಮ್ಮ ಮಾಹಿತಿ CareBridge ಬಳಿಯೇ ಇರುತ್ತದೆ', text: 'ಎಲ್ಲಾ ಪ್ರಕ್ರಿಯೆ CareBridge ನ ಸ್ವಂತ ಸುರಕ್ಷಿತ ಸರ್ವರ್‌ಗಳಲ್ಲಿ ಮಾತ್ರ ನಡೆಯುತ್ತದೆ. ನಿಮ್ಮ ಯಾವುದೇ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ಹೊರಗಿನ ಯಾವುದೇ ಕಂಪನಿಯೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳುವುದಿಲ್ಲ.' },
      { label: 'ಬಳಕೆಯ ನಂತರ ಅಳಿಸಲಾಗುತ್ತದೆ', text: 'ಆಡಿಯೋವನ್ನು ಪಠ್ಯಕ್ಕೆ ಪರಿವರ್ತಿಸಿದ ತಕ್ಷಣ ಅಳಿಸಲಾಗುತ್ತದೆ. ನಿಮ್ಮ ದಾಖಲೆಯಲ್ಲಿ ವೈದ್ಯರ ಟಿಪ್ಪಣಿಗಳು ಮಾತ್ರ ಉಳಿಯುತ್ತವೆ.' },
      { label: 'ನಿಮ್ಮ ಆಯ್ಕೆ', text: 'ನೀವು ನಿರಾಕರಿಸಬಹುದು, ಸಮಾಲೋಚನೆ ಎಂದಿನಂತೆ ಮುಂದುವರಿಯುತ್ತದೆ. "ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ" ಬಟನ್ ಒತ್ತಿ ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಬಹುದು.' },
    ],
    allow: 'ರೆಕಾರ್ಡಿಂಗ್‌ಗೆ ಅನುಮತಿ ನೀಡಿ',
    deny: 'ಅನುಮತಿ ನೀಡಬೇಡಿ',
    stop: 'ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ',
    recordingBanner: 'AI ಸಾರಾಂಶಕ್ಕಾಗಿ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ. AI ಬಳಕೆಯ ಮೊದಲು ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ವೈಯಕ್ತಿಕ ವಿವರಗಳನ್ನು ತೆಗೆದುಹಾಕಲಾಗುತ್ತದೆ.',
  },
};
