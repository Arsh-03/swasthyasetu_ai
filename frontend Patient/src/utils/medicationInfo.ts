import type { CarePlanMedication, DoseSlot } from '../services/api';
import type { SupportedLanguage } from './translations';
import { localized, type LocalizedText } from './localized';

export type MedicationForm = 'tablet' | 'syrup' | 'capsule' | 'drops' | 'injection';
export type MealRelation = 'after_food' | 'with_food' | 'before_food' | 'bedtime';

export interface ResolvedMedicationInfo {
  shortName: string;
  form: MedicationForm;
  purposePatient: string;
  purposeDetail: string;
  doseAmount: string;
  mealRelation: MealRelation;
  intakeMethod: 'with_water' | 'oral';
  timingLabel: string;
  howToTake: string;
  rawClinicalName: string;
}

interface MedicationDictionaryEntry {
  pattern: RegExp;
  shortName: string;
  form: MedicationForm;
  purpose: LocalizedText;
  purposeDetail: LocalizedText;
  doseAmount: LocalizedText;
  mealRelation: MealRelation;
  intakeMethod: 'with_water' | 'oral';
  howToTake: LocalizedText;
}

const MEDICATION_CATALOG: MedicationDictionaryEntry[] = [
  {
    pattern: /potassium.*citrate|citrate.*solution|potassium.*magnesium/i,
    shortName: 'Potassium Citrate',
    form: 'syrup',
    purpose: {
      en: 'For dissolving kidney stones',
      kn: 'ಮೂತ್ರಪಿಂಡದ ಕಲ್ಲು ಕರಗಿಸಲು',
      hi: 'गुर्दे की पथरी घोलने के लिए',
    },
    purposeDetail: {
      en: 'Alkalinizes urine to dissolve calcium oxalate and uric acid stones, preventing new stones.',
      kn: 'ಮೂತ್ರದಲ್ಲಿನ ಆಮ್ಲೀಯತೆ ಕಡಿಮೆ ಮಾಡಿ ಕಲ್ಲುಗಳನ್ನು ಕರಗಿಸಲು ಮತ್ತು ಹೊಸ ಕಲ್ಲು ಉಂಟಾಗದಂತೆ ತಡೆಯಲು ನೆರವಾಗುತ್ತದೆ.',
      hi: 'पेशाब में एसिड को कम करके पथरी को गलाने और नई पथरी बनने से रोकने में मदद करता है।',
    },
    doseAmount: {
      en: '10 mL in a glass of water',
      kn: '10 ಮಿಲಿ ಒಂದು ಲೋಟ ನೀರಿನಲ್ಲಿ',
      hi: '10 मिलीलीटर एक गिलास पानी में',
    },
    mealRelation: 'after_food',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Dilute 10 mL syrup in a full glass of water. Drink immediately after food.',
      kn: '10 ಮಿಲಿ ಸಿರಪ್ ಅನ್ನು ಒಂದು ಲೋಟ ನೀರಿನಲ್ಲಿ ಬೆರೆಸಿ ಊಟದ ನಂತರ ತಕ್ಷಣ ಕುಡಿಯಿರಿ.',
      hi: '10 मिली सिरप को एक पूरे गिलास पानी में घोलें और भोजन के तुरंत बाद पिएं।',
    },
  },
  {
    pattern: /metformin/i,
    shortName: 'Metformin',
    form: 'tablet',
    purpose: {
      en: 'For sugar control',
      kn: 'ಸಕ್ಕರೆ (ಡಯಾಬಿಟಿಸ್) ನಿಯಂತ್ರಣಕ್ಕೆ',
      hi: 'शुगर (डायबिटीज) नियंत्रण के लिए',
    },
    purposeDetail: {
      en: 'Helps maintain balanced blood glucose levels and improves natural insulin sensitivity.',
      kn: 'ರಕ್ತದಲ್ಲಿನ ಸಕ್ಕರೆ ಮಟ್ಟವನ್ನು ಸಮತೋಲನದಲ್ಲಿಡಲು ಮತ್ತು ಇನ್ಸುಲಿನ್ ಸರಿಯಾಗಿ ಕೆಲಸ ಮಾಡಲು ನೆರವಾಗುತ್ತದೆ.',
      hi: 'खून में शुगर के स्तर को संतुलित रखने और इंसुलिन के सही उपयोग में मदद करता है।',
    },
    doseAmount: {
      en: '1 tablet (500 mg)',
      kn: '1 ಮಾತ್ರೆ (500 mg)',
      hi: '1 गोली (500 mg)',
    },
    mealRelation: 'with_food',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Swallow whole with a glass of water during or right after your meal.',
      kn: 'ಉಪಹಾರ ಅಥವಾ ಊಟದ ಸಮಯದಲ್ಲಿ ಒಂದು ಮಾತ್ರೆಯನ್ನು ನೀರಿನೊಂದಿಗೆ ನುಂಗಿ.',
      hi: 'नाश्ते या भोजन के समय अथवा तुरंत बाद पानी के साथ एक गोली निगलें।',
    },
  },
  {
    pattern: /tamsulosin/i,
    shortName: 'Tamsulosin',
    form: 'tablet',
    purpose: {
      en: 'For easier urination & stone passage',
      kn: 'ಸುಲಭ ಮೂತ್ರ ವಿಸರ್ಜನೆಗಾಗಿ',
      hi: 'पेशाब की रुकावट कम करने के लिए',
    },
    purposeDetail: {
      en: 'Relaxes smooth muscle in the bladder neck and ureter to help kidney stones pass freely.',
      kn: 'ಮೂತ್ರನಾಳದ ಸ್ನಾಯುಗಳನ್ನು ಸಡಿಲಗೊಳಿಸಿ ಮೂತ್ರ ಸರಾಗವಾಗಿ ಹೋಗಲು ಮತ್ತು ಕಲ್ಲು ಹೊರಬರಲು ನೆರವಾಗುತ್ತದೆ.',
      hi: 'मूत्र नलिका की मांसपेशियों को शिथिल करता है जिससे पथरी आसानी से निकले और पेशाब में रुकावट न हो।',
    },
    doseAmount: {
      en: '1 tablet (0.4 mg)',
      kn: '1 ಮಾತ್ರೆ (0.4 mg)',
      hi: '1 गोली (0.4 mg)',
    },
    mealRelation: 'bedtime',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Take one tablet at night about 30 minutes after dinner before sleeping.',
      kn: 'ರಾತ್ರಿ ಊಟವಾದ ಸುಮಾರು 30 ನಿಮಿಷಗಳ ನಂತರ ಮಲಗುವ ಮುನ್ನ ಒಂದು ಮಾತ್ರೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
      hi: 'रात के खाने के लगभग 30 मिनट बाद सोने से पहले एक गोली लें।',
    },
  },
  {
    pattern: /drotaverine/i,
    shortName: 'Drotaverine',
    form: 'tablet',
    purpose: {
      en: 'For stomach & colic pain',
      kn: 'ಹೊಟ್ಟೆ ಶೂಲೆ ಮತ್ತು ನೋವಿಗೆ',
      hi: 'पेट दर्द और ऐंठन के लिए',
    },
    purposeDetail: {
      en: 'Fast-acting smooth muscle antispasmodic for acute flank or renal colic pain.',
      kn: 'ಹೊಟ್ಟೆ ಮತ್ತು ಮೂತ್ರಪಿಂಡದ ತೀವ್ರ ಶೂಲೆ ನೋವು ಮತ್ತು ಸೆಳೆತವನ್ನು ಶಮನ ಮಾಡುತ್ತದೆ.',
      hi: 'पेट और गुर्दे की नसों में अचानक होने वाले दर्द और ऐंठन से तुरंत आराम दिलाता है।',
    },
    doseAmount: {
      en: '1 tablet (80 mg)',
      kn: '1 ಮಾತ್ರೆ (80 mg)',
      hi: '1 गोली (80 mg)',
    },
    mealRelation: 'after_food',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Take one tablet only when experiencing acute pain (maximum 3 tablets per day).',
      kn: 'ತೀವ್ರ ನೋವು ಬಂದಾಗ ಮಾತ್ರ 1 ಮಾತ್ರೆ ತೆಗೆದುಕೊಳ್ಳಿ (ದಿನಕ್ಕೆ ಗರಿಷ್ಠ 3 ಮಾತ್ರೆಗಳು).',
      hi: 'तेज दर्द होने पर ही 1 गोली लें (दिन में अधिकतम 3 गोलियां)।',
    },
  },
  {
    pattern: /paracetamol|dolo|crocin/i,
    shortName: 'Paracetamol',
    form: 'tablet',
    purpose: {
      en: 'For fever & mild pain',
      kn: 'ಜ್ವರ ಮತ್ತು ಮೈಕೈ ನೋವಿಗೆ',
      hi: 'बुखार और बदन दर्द के लिए',
    },
    purposeDetail: {
      en: 'Brings down high body temperature and relieves headache or body aches.',
      kn: 'ದೇಹದ ಉಷ್ಣತೆ ತಗ್ಗಿಸಿ ಜ್ವರ ಮತ್ತು ಮೈಕೈ ನೋವಿನಿಂದ ಉಪಶಮನ ನೀಡುತ್ತದೆ.',
      hi: 'शरीर का तापमान कम करता है और बुखार, सिरदर्द या बदन दर्द में राहत देता है।',
    },
    doseAmount: {
      en: '1 tablet (650 mg)',
      kn: '1 ಮಾತ್ರೆ (650 mg)',
      hi: '1 गोली (650 mg)',
    },
    mealRelation: 'after_food',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Take one tablet with water after food when fever or pain is felt.',
      kn: 'ಜ್ವರ ಅಥವಾ ನೋವು ಬಂದಾಗ ಊಟದ ನಂತರ ಒಂದು ಮಾತ್ರೆ ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
      hi: 'बुखार या दर्द होने पर भोजन के बाद पानी के साथ एक गोली लें।',
    },
  },
  {
    pattern: /ciprofloxacin/i,
    shortName: 'Ciprofloxacin',
    form: 'tablet',
    purpose: {
      en: 'For urinary infection',
      kn: 'ಮೂತ್ರದ ಸೋಂಕಿಗೆ (ಇನ್‌ಫೆಕ್ಷನ್)',
      hi: 'पेशाब के संक्रमण के लिए',
    },
    purposeDetail: {
      en: 'Antibacterial therapy that clears bacterial infection in the urinary tract.',
      kn: 'ಮೂತ್ರನಾಳದಲ್ಲಿ ಉಂಟಾಗಿರುವ ಬ್ಯಾಕ್ಟೀರಿಯಾ ಸೋಂಕನ್ನು ನಿವಾರಿಸುವ ಆಂಟಿಬಯೋಟಿಕ್.',
      hi: 'मूत्र मार्ग के बैक्टीरिया संक्रमण को पूरी तरह खत्म करने वाली एंटीबायोटिक दवा।',
    },
    doseAmount: {
      en: '1 tablet (500 mg)',
      kn: '1 ಮಾತ್ರೆ (500 mg)',
      hi: '1 गोली (500 mg)',
    },
    mealRelation: 'after_food',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Complete the full course as prescribed. Take after food with plenty of fluids.',
      kn: 'ವೈದ್ಯರು ಸೂಚಿಸಿದ ಪೂರ್ಣ ಕೋರ್ಸ್ ಮುಗಿಸಿ. ಊಟದ ನಂತರ ಹೆಚ್ಚು ನೀರು ಕುಡಿಯುತ್ತಾ ತೆಗೆದುಕೊಳ್ಳಿ.',
      hi: 'डॉक्टर द्वारा बताया गया पूरा कोर्स खत्म करें। भोजन के बाद भरपूर पानी के साथ लें।',
    },
  },
  {
    pattern: /atorvastatin/i,
    shortName: 'Atorvastatin',
    form: 'tablet',
    purpose: {
      en: 'For cholesterol & heart protection',
      kn: 'ಕೊಲೆಸ್ಟ್ರಾಲ್ ಮತ್ತು ಹೃದಯ ರಕ್ಷಣೆಗೆ',
      hi: 'कोलेस्ट्रॉल और दिल की सुरक्षा के लिए',
    },
    purposeDetail: {
      en: 'Reduces bad cholesterol (LDL) and protects blood vessels from blockage.',
      kn: 'ಕೆಟ್ಟ ಕೊಲೆಸ್ಟ್ರಾಲ್ ಕಡಿಮೆ ಮಾಡಿ ರಕ್ತನಾಳಗಳು ಮುಚ್ಚಿಹೋಗದಂತೆ ತಡೆಯುತ್ತದೆ.',
      hi: 'खराब कोलेस्ट्रॉल को कम करके दिल की धमनियों को सुरक्षित रखता है।',
    },
    doseAmount: {
      en: '1 tablet (20 mg)',
      kn: '1 ಮಾತ್ರೆ (20 mg)',
      hi: '1 गोली (20 mg)',
    },
    mealRelation: 'bedtime',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Take one tablet at night with water after dinner.',
      kn: 'ರಾತ್ರಿ ಊಟದ ನಂತರ ನೀರಿನೊಂದಿಗೆ ಒಂದು ಮಾತ್ರೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
      hi: 'रात के खाने के बाद पानी के साथ एक गोली लें।',
    },
  },
  {
    pattern: /telmisartan/i,
    shortName: 'Telmisartan',
    form: 'tablet',
    purpose: {
      en: 'For blood pressure control',
      kn: 'ರಕ್ತದೊತ್ತಡ (BP) ನಿಯಂತ್ರಣಕ್ಕೆ',
      hi: 'ब्लड प्रेशर (बीपी) नियंत्रण के लिए',
    },
    purposeDetail: {
      en: 'Keeps blood vessels relaxed and maintains healthy blood pressure.',
      kn: 'ರಕ್ತದೊತ್ತಡವನ್ನು ಸಹಜ ಸ್ಥಿತಿಯಲ್ಲಿಟ್ಟು ಹೃದಯ ಮತ್ತು ಮೂತ್ರಪಿಂಡವನ್ನು ರಕ್ಷಿಸುತ್ತದೆ.',
      hi: 'रक्तचाप को नियंत्रित रखकर हृदय और गुर्दे की सुरक्षा करता है।',
    },
    doseAmount: {
      en: '1 tablet (40 mg)',
      kn: '1 ಮಾತ್ರೆ (40 mg)',
      hi: '1 गोली (40 mg)',
    },
    mealRelation: 'after_food',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Take once daily in the morning with or after breakfast.',
      kn: 'ಪ್ರತಿದಿನ ಬೆಳಿಗ್ಗೆ ಉಪಹಾರದ ನಂತರ ನೀರಿನೊಂದಿಗೆ ಒಂದು ಮಾತ್ರೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
      hi: 'रोजाना सुबह नाश्ते के बाद एक गोली पानी से लें।',
    },
  },
  {
    pattern: /levothyroxine|thyroxine/i,
    shortName: 'Thyroxine',
    form: 'tablet',
    purpose: {
      en: 'For thyroid hormone control',
      kn: 'ಥೈರಾಯ್ಡ್ ನಿಯಂತ್ರಣಕ್ಕೆ',
      hi: 'थायराइड नियंत्रण के लिए',
    },
    purposeDetail: {
      en: 'Restores essential thyroid hormone levels for healthy daily energy.',
      kn: 'ದೇಹಕ್ಕೆ ಅಗತ್ಯವಿರುವ ಥೈರಾಯ್ಡ್ ಹಾರ್ಮೋನ್ ಮಟ್ಟವನ್ನು ಸಮತೋಲನಗೊಳಿಸುತ್ತದೆ.',
      hi: 'शरीर के आवश्यक थायराइड हार्मोन के स्तर को संतुलित रखता है।',
    },
    doseAmount: {
      en: '1 tablet (50 mcg)',
      kn: '1 ಮಾತ್ರೆ (50 mcg)',
      hi: '1 गोली (50 mcg)',
    },
    mealRelation: 'before_food',
    intakeMethod: 'with_water',
    howToTake: {
      en: 'Take on an empty stomach first thing in the morning with plain water.',
      kn: 'ಬೆಳಿಗ್ಗೆ ಎದ್ದ ತಕ್ಷಣ ಖಾಲಿ ಹೊಟ್ಟೆಯಲ್ಲಿ ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ.',
      hi: 'सुबह उठते ही खाली पेट केवल सादे पानी के साथ एक गोली लें।',
    },
  },
];

export const cleanMedicineShortName = (fullName: string): string => {
  if (!fullName) return 'Medicine';
  // Check known catalog first
  for (const entry of MEDICATION_CATALOG) {
    if (entry.pattern.test(fullName)) return entry.shortName;
  }
  // Generic cleanup
  let s = fullName.replace(/\b(Tablet|Oral Solution|Solution|Syrup|Capsule|Injection|Suspension|Drops|Ointment|Gel|Cream|SR|ER|CR|XL|OD|BD|TDS|IP|BP|USP)\b/gi, '');
  s = s.replace(/\bHydrochloride\b/gi, '');
  s = s.replace(/\b\d+(\.\d+)?\s*(mg|ml|mcg|g|iu)\b/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s || fullName.split(' ')[0] || 'Medicine';
};

export const inferMedicineForm = (name: string, dosage?: string): MedicationForm => {
  const text = `${name} ${dosage || ''}`.toLowerCase();
  if (/solution|syrup|liquid|suspension|elixir|\bml\b/i.test(text)) return 'syrup';
  if (/capsule|\bcap\b/i.test(text)) return 'capsule';
  if (/drops?|eye drop|ear drop/i.test(text)) return 'drops';
  if (/injection|\binj\b|vial|syringe/i.test(text)) return 'injection';
  return 'tablet';
};

export const resolveMedicationInfo = (
  med: CarePlanMedication,
  lang: SupportedLanguage
): ResolvedMedicationInfo => {
  const clinicalName = med.name || '';
  const dosageStr = localized(med.dosage, lang) || '';
  const timingStr = localized(med.timing, lang) || '';

  // Check explicit known dictionary entry
  const matchedEntry = MEDICATION_CATALOG.find((entry) => entry.pattern.test(clinicalName));

  // 1. Short name
  const shortName = med.short_name || matchedEntry?.shortName || cleanMedicineShortName(clinicalName);

  // 2. Form
  const form: MedicationForm = (med.form as MedicationForm) || matchedEntry?.form || inferMedicineForm(clinicalName, dosageStr);

  // 3. Purpose line
  let purposePatient = localized(med.purpose_patient, lang);
  if (!purposePatient && matchedEntry) {
    purposePatient = localized(matchedEntry.purpose, lang);
  }
  if (!purposePatient) {
    const rawPurpose = localized(med.purpose, lang);
    purposePatient = rawPurpose || (lang === 'kn' ? 'ವೈದ್ಯರು ಸೂಚಿಸಿದ ಔಷಧಿ' : lang === 'hi' ? 'डॉक्टर द्वारा सुझाई गई दवा' : 'Prescribed medicine');
  }

  // 4. Purpose detail explanation
  let purposeDetail = matchedEntry ? localized(matchedEntry.purposeDetail, lang) : '';
  if (!purposeDetail) {
    purposeDetail = localized(med.purpose, lang) || purposePatient;
  }

  // 5. Dose amount
  let doseAmount = localized(med.instructions?.dose_amount, lang);
  if (!doseAmount && matchedEntry) {
    doseAmount = localized(matchedEntry.doseAmount, lang);
  }
  if (!doseAmount) {
    doseAmount = dosageStr || (form === 'syrup' ? '10 mL' : '1 tablet');
  }

  // 6. Meal relation
  let mealRelation: MealRelation = (med.instructions?.meal_relation as MealRelation) || matchedEntry?.mealRelation || 'after_food';
  if (!med.instructions?.meal_relation && !matchedEntry) {
    const tl = timingStr.toLowerCase();
    if (/bedtime|night|sleep/.test(tl)) mealRelation = 'bedtime';
    else if (/before|empty/.test(tl)) mealRelation = 'before_food';
    else if (/with|during/.test(tl)) mealRelation = 'with_food';
    else mealRelation = 'after_food';
  }

  // 7. Intake method
  const intakeMethod = (med.instructions?.intake_method as 'with_water' | 'oral') || matchedEntry?.intakeMethod || 'with_water';

  // 8. Timing label
  let timingLabel = localized(med.instructions?.timing_label, lang);
  if (!timingLabel) {
    timingLabel = timingStr || (lang === 'kn' ? 'ಸೂಚನೆಯಂತೆ' : lang === 'hi' ? 'निर्देशानुसार' : 'As prescribed');
  }

  // 9. How to take
  let howToTake = matchedEntry ? localized(matchedEntry.howToTake, lang) : '';
  if (!howToTake) {
    howToTake = timingStr ? `${timingStr}.` : `${doseAmount} ${timingLabel}.`;
  }

  return {
    shortName,
    form,
    purposePatient,
    purposeDetail,
    doseAmount,
    mealRelation,
    intakeMethod,
    timingLabel,
    howToTake,
    rawClinicalName: clinicalName,
  };
};

/**
 * Requirement 4: Read aloud in patient's language.
 * Example prompt: "Metformin, for sugar control. Take one tablet after breakfast."
 */
export const getMedicationSpeechText = (
  med: CarePlanMedication,
  slot: DoseSlot,
  lang: SupportedLanguage
): string => {
  const info = resolveMedicationInfo(med, lang);

  if (lang === 'kn') {
    let slotMoment = 'ಉಪಹಾರದೊಂದಿಗೆ';
    if (slot === 'afternoon') slotMoment = 'ಮಧ್ಯಾಹ್ನದ ಊಟದ ನಂತರ';
    else if (slot === 'night') slotMoment = 'ರಾತ್ರಿ ಊಟದ ನಂತರ ಮಲಗುವಾಗ';
    else if (slot === 'prn') slotMoment = 'ನೋವು ಅಥವಾ ತೊಂದರೆ ಬಂದಾಗ';

    return `${info.shortName}, ${info.purposePatient}. ${slotMoment} ${info.doseAmount} ತೆಗೆದುಕೊಳ್ಳಿ.`;
  }

  if (lang === 'hi') {
    let slotMoment = 'नाश्ते के साथ';
    if (slot === 'afternoon') slotMoment = 'दोपहर के भोजन के बाद';
    else if (slot === 'night') slotMoment = 'रात के खाने के बाद सोते समय';
    else if (slot === 'prn') slotMoment = 'तकलीफ या दर्द होने पर';

    return `${info.shortName}, ${info.purposePatient}। ${slotMoment} ${info.doseAmount} लें।`;
  }

  // Default English
  let slotMoment = 'after breakfast';
  if (info.mealRelation === 'with_food') slotMoment = 'with breakfast';
  if (slot === 'afternoon') slotMoment = 'after lunch';
  else if (slot === 'night') slotMoment = 'after dinner at bedtime';
  else if (slot === 'prn') slotMoment = 'when needed for pain';

  return `${info.shortName}, ${info.purposePatient.toLowerCase().startsWith('for') ? info.purposePatient : `for ${info.purposePatient}`}. Take ${info.doseAmount} ${slotMoment}.`;
};
