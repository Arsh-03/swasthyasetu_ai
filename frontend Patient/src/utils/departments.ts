/**
 * OPD departments (ids match backend/app/care_catalog.py): display name in each language, icon and tone.
 * The health issues the patient picks from come from the backend (GET /care/departments).
 */
import type { IconName } from '../components/ui';
import type { Tone } from '../theme/tokens';
import type { SupportedLanguage } from './translations';

interface DepartmentInfo {
  icon: IconName;
  tone: Tone;
  name: Record<SupportedLanguage, string>;
}

export const DEPARTMENTS: Record<string, DepartmentInfo> = {
  general_medicine: { icon: 'doctor', tone: 'primary', name: { en: 'General Medicine', hi: 'सामान्य चिकित्सा', kn: 'ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ' } },
  cardiology: { icon: 'heart', tone: 'danger', name: { en: 'Cardiology', hi: 'हृदय रोग', kn: 'ಹೃದ್ರೋಗ' } },
  dermatology: { icon: 'hand', tone: 'gold', name: { en: 'Dermatology', hi: 'त्वचा रोग', kn: 'ಚರ್ಮರೋಗ' } },
  orthopaedics: { icon: 'joint', tone: 'navy', name: { en: 'Orthopaedics', hi: 'हड्डी रोग', kn: 'ಮೂಳೆ ಚಿಕಿತ್ಸೆ' } },
  ent: { icon: 'ear', tone: 'teal', name: { en: 'ENT', hi: 'नाक, कान, गला', kn: 'ಕಿವಿ, ಮೂಗು, ಗಂಟಲು' } },
  ophthalmology: { icon: 'eye', tone: 'primary', name: { en: 'Eye (Ophthalmology)', hi: 'नेत्र रोग', kn: 'ನೇತ್ರ ವಿಭಾಗ' } },
  obgyn: { icon: 'female', tone: 'danger', name: { en: 'Obstetrics & Gynaecology', hi: 'स्त्री एवं प्रसूति रोग', kn: 'ಸ್ತ್ರೀರೋಗ ಮತ್ತು ಪ್ರಸೂತಿ' } },
  paediatrics: { icon: 'baby', tone: 'success', name: { en: 'Paediatrics', hi: 'बाल रोग', kn: 'ಮಕ್ಕಳ ವಿಭಾಗ' } },
  endocrinology: { icon: 'lab', tone: 'warning', name: { en: 'Diabetes & Thyroid', hi: 'मधुमेह और थायराइड', kn: 'ಮಧುಮೇಹ ಮತ್ತು ಥೈರಾಯ್ಡ್' } },
  pulmonology: { icon: 'cough', tone: 'teal', name: { en: 'Chest (Pulmonology)', hi: 'छाती और फेफड़े', kn: 'ಎದೆ ಮತ್ತು ಶ್ವಾಸಕೋಶ' } },
  gastroenterology: { icon: 'stomach', tone: 'gold', name: { en: 'Stomach (Gastroenterology)', hi: 'पेट और पाचन', kn: 'ಹೊಟ್ಟೆ ಮತ್ತು ಜೀರ್ಣಕ್ರಿಯೆ' } },
  neurology: { icon: 'headache', tone: 'navy', name: { en: 'Neurology', hi: 'तंत्रिका रोग', kn: 'ನರರೋಗ' } },
  psychiatry: { icon: 'feelingBetter', tone: 'success', name: { en: 'Mental Health', hi: 'मानसिक स्वास्थ्य', kn: 'ಮಾನಸಿಕ ಆರೋಗ್ಯ' } },
  urology: { icon: 'drop', tone: 'warning', name: { en: 'Urology', hi: 'मूत्र रोग', kn: 'ಮೂತ್ರರೋಗ' } },
  dental: { icon: 'tooth', tone: 'primary', name: { en: 'Dental', hi: 'दंत चिकित्सा', kn: 'ದಂತ ಚಿಕಿತ್ಸೆ' } },
};

/** Health issue id -> icon (issue labels come from the backend). */
export const ISSUE_ICONS: Record<string, IconName> = {
  general: 'fever',
  heart_bp: 'heart',
  diabetes_thyroid: 'lab',
  skin_hair: 'hand',
  bones_joints: 'joint',
  breathing: 'cough',
  stomach: 'stomach',
  urine_kidney: 'drop',
  eyes: 'eye',
  ent: 'ear',
  women: 'female',
  child: 'baby',
  headache_nerves: 'headache',
  mind: 'feelingBetter',
  teeth: 'tooth',
};

const FALLBACK: DepartmentInfo = DEPARTMENTS.general_medicine;

export const departmentInfo = (id: string | null | undefined): DepartmentInfo => (id && DEPARTMENTS[id]) || FALLBACK;

/** Department name in the app language; empty when unknown (callers then show the doctor's specialty). */
export const departmentName = (id: string | null | undefined, lang: SupportedLanguage): string =>
  id && DEPARTMENTS[id] ? DEPARTMENTS[id].name[lang] || DEPARTMENTS[id].name.en : '';

/** "Dr. C. R. Patil (MS, MCh Urology)" -> "CP" (for the avatar). */
export const doctorInitials = (name: string): string => {
  const words = name
    .replace(/\(.*?\)/g, '')
    .replace(/^\s*dr\.?\s*/i, '')
    .split(/[\s.]+/)
    .filter(Boolean);
  if (words.length === 0) return 'Dr';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
};

/** "Dr. C. R. Patil (MS, MCh Urology)" -> "Dr. C. R. Patil" (qualifications shown separately). */
export const doctorShortName = (name: string): string => name.replace(/\s*\(.*?\)\s*/g, ' ').trim();

/** "(MS, MCh Urology)" part of a name, if any. */
export const doctorQualifications = (name: string): string => {
  const m = name.match(/\(([^)]*)\)/);
  return m ? m[1] : '';
};
