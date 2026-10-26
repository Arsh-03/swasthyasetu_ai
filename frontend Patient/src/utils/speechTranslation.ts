import type { SupportedLanguage } from './translations';

/**
 * Natural spoken translation formatter for rural & first-time smartphone users.
 * Converts technical text, clock times (e.g. 9:30 AM -> "सुबह 9:30 बजे"),
 * medical units (mg, mL), abbreviations (Dr., BP, PRN), and symbols into
 * natural, phonetically accurate spoken phrases for English, Kannada, and Hindi.
 */

export const formatSpokenText = (rawText: string, lang: SupportedLanguage): string => {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText.trim();

  // 1. Time conversion (e.g. "9:30 AM", "8:00 AM", "1:30 PM", "8:30 PM")
  text = text.replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/g, (match, hStr, mStr, meridiem) => {
    let hour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);
    const mUpper = (meridiem || '').toUpperCase();

    // Determine part of day
    let isNight = false;
    let isAfternoon = false;
    let isEvening = false;
    let isMorning = false;

    if (mUpper === 'PM') {
      if (hour === 12) isAfternoon = true;
      else if (hour >= 1 && hour <= 4) isAfternoon = true;
      else if (hour >= 5 && hour <= 7) isEvening = true;
      else isNight = true;
    } else if (mUpper === 'AM') {
      if (hour === 12 || hour < 4) isNight = true;
      else isMorning = true;
    } else {
      // 24h format
      if (hour >= 4 && hour < 12) isMorning = true;
      else if (hour >= 12 && hour < 17) isAfternoon = true;
      else if (hour >= 17 && hour < 20) isEvening = true;
      else isNight = true;
    }

    const minDisplay = minute === 0 ? '' : `:${mStr}`;

    if (lang === 'hi') {
      const timeStr = `${hour}${minDisplay}`;
      if (isMorning) return `सुबह ${timeStr} बजे`;
      if (isAfternoon) return `दोपहर ${timeStr} बजे`;
      if (isEvening) return `शाम ${timeStr} बजे`;
      return `रात ${timeStr} बजे`;
    }

    if (lang === 'kn') {
      const timeStr = `${hour}${minDisplay}`;
      if (isMorning) return `ಬೆಳಿಗ್ಗೆ ${timeStr} ಗಂಟೆಗೆ`;
      if (isAfternoon) return `ಮಧ್ಯಾಹ್ನ ${timeStr} ಗಂಟೆಗೆ`;
      if (isEvening) return `ಸಂಜೆ ${timeStr} ಗಂಟೆಗೆ`;
      return `ರಾತ್ರಿ ${timeStr} ಗಂಟೆಗೆ`;
    }

    // English
    const period = isMorning ? 'in the morning' : isAfternoon ? 'in the afternoon' : isEvening ? 'in the evening' : 'at night';
    return `${hour}:${mStr} ${mUpper || (hour >= 12 ? 'PM' : 'AM')} ${period}`;
  });

  // 2. Pure hour meridiem format (e.g. "8 AM", "2 PM" without minutes)
  text = text.replace(/(?<!:)\b(\d{1,2})\s*(AM|PM|am|pm)\b/g, (match, hStr, meridiem) => {
    const hour = parseInt(hStr, 10);
    const mUpper = meridiem.toUpperCase();
    const isMorning = mUpper === 'AM';

    if (lang === 'hi') {
      return isMorning ? `सुबह ${hour} बजे` : hour >= 7 ? `रात ${hour} बजे` : `दोपहर ${hour} बजे`;
    }
    if (lang === 'kn') {
      return isMorning ? `ಬೆಳಿಗ್ಗೆ ${hour} ಗಂಟೆಗೆ` : hour >= 7 ? `ರಾತ್ರಿ ${hour} ಗಂಟೆಗೆ` : `ಮಧ್ಯಾಹ್ನ ${hour} ಗಂಟೆಗೆ`;
    }
    return `${hour}:00 ${mUpper}`;
  });

  // 3. Common abbreviations and medical units
  if (lang === 'hi') {
    text = text
      .replace(/\bDr\.?\s+/gi, 'डॉक्टर ')
      .replace(/\b(\d+)\s*mg\b/gi, '$1 मिलीग्राम')
      .replace(/\b(\d+)\s*m[lL]\b/gi, '$1 मिलीलीटर')
      .replace(/\b(\d+)\s*tab(s|let|lets)?\b/gi, '$1 गोली')
      .replace(/\bOD\b/g, 'दिन में एक बार')
      .replace(/\bBD\b/g, 'दिन में दो बार')
      .replace(/\bTDS\b/g, 'दिन में तीन बार')
      .replace(/\bPRN\b/gi, 'ज़रूरत पड़ने पर')
      .replace(/\bSOS\b/gi, 'ज़रूरत पड़ने पर')
      .replace(/\bBP\b/g, 'ब्लड प्रेशर')
      .replace(/✓\s*Taken/gi, 'ले ली गई')
      .replace(/Take\b/gi, 'लें')
      .replace(/Taken\b/gi, 'दवा ली गई');
  } else if (lang === 'kn') {
    text = text
      .replace(/\bDr\.?\s+/gi, 'ಡಾಕ್ಟರ್ ')
      .replace(/\b(\d+)\s*mg\b/gi, '$1 ಮಿಲಿಗ್ರಾಂ')
      .replace(/\b(\d+)\s*m[lL]\b/gi, '$1 ಮಿಲಿಲೀಟರ್')
      .replace(/\b(\d+)\s*tab(s|let|lets)?\b/gi, '$1 ಮಾತ್ರೆ')
      .replace(/\bOD\b/g, 'ದಿನಕ್ಕೆ ಒಂದು ಬಾರಿ')
      .replace(/\bBD\b/g, 'ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ')
      .replace(/\bTDS\b/g, 'ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ')
      .replace(/\bPRN\b/gi, 'ಅಗತ್ಯವಿದ್ದಾಗ ಮಾತ್ರ')
      .replace(/\bSOS\b/gi, 'ಅಗತ್ಯವಿದ್ದಾಗ ಮಾತ್ರ')
      .replace(/\bBP\b/g, 'ರಕ್ತದೊತ್ತಡ')
      .replace(/✓\s*Taken/gi, 'ತೆಗೆದುಕೊಂಡಿದೆ')
      .replace(/Take\b/gi, 'ತೆಗೆದುಕೊಳ್ಳಿ')
      .replace(/Taken\b/gi, 'ತೆಗೆದುಕೊಂಡಿದೆ');
  } else {
    text = text
      .replace(/\bDr\.?\s+/gi, 'Doctor ')
      .replace(/\b(\d+)\s*mg\b/gi, '$1 milligram')
      .replace(/\b(\d+)\s*m[lL]\b/gi, '$1 milliliter')
      .replace(/\bOD\b/g, 'once daily')
      .replace(/\bBD\b/g, 'twice daily')
      .replace(/\bTDS\b/g, 'three times daily')
      .replace(/\bPRN\b/gi, 'as needed')
      .replace(/\bSOS\b/gi, 'as needed')
      .replace(/\bBP\b/g, 'blood pressure')
      .replace(/✓/g, 'completed');
  }

  // 4. Symbols cleanup for smooth speech
  text = text
    .replace(/[•|·]/g, ', ')
    .replace(/[_~#*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
};
