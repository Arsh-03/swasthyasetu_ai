import { useLanguage } from '../../i18n/LanguageContext';
import type { SupportedLanguage } from '../../utils/translations';
import { localized, type LocalizedText } from '../../utils/localized';
import { departmentIdFrom, spokenDate, spokenDepartment, spokenDoctor, spokenTime } from '../format';
import { en } from './en';
import { hi } from './hi';
import { kn } from './kn';
import type { AppointmentFacts, Scripts } from './types';

export type { AppointmentFacts, Scripts, TabKey } from './types';

export const SCRIPTS: Record<SupportedLanguage, Scripts> = { en, kn, hi };

/** Spoken scripts for the app language. */
export const useScripts = (): Scripts => SCRIPTS[useLanguage().lang];

interface AppointmentLike {
  date: string;
  time: string;
  doctorName?: string;
  department?: string;
  specialty?: LocalizedText;
  facility?: LocalizedText;
  mode?: string;
  isRescheduled?: boolean;
  visitStatus?: string;
}

/**
 * App appointment data → the facts a script needs (spoken name, natural date and time,
 * plain-language department). Used by the Home card, its Listen button and appointment rows,
 * so they always say the same thing.
 */
export const appointmentFacts = (apt: AppointmentLike, lang: SupportedLanguage, now?: Date): AppointmentFacts => {
  const deptId = departmentIdFrom(apt.department, localized(apt.specialty, 'en'), apt.doctorName?.match(/\(([^)]*)\)/)?.[1]);
  const dept = spokenDepartment(deptId, lang);
  return {
    doctor: spokenDoctor(apt.doctorName, lang),
    when: spokenDate(apt.date, lang, apt.time, now),
    time: spokenTime(apt.time, lang),
    topic: dept?.topic,
    specialist: dept?.specialist,
    video: (apt.mode || '').toLowerCase().includes('video'),
    place: localized(apt.facility, lang) || undefined,
    rescheduled: apt.isRescheduled,
    cancelled: apt.visitStatus === 'cancelled' || apt.visitStatus === 'no_show',
    done: apt.visitStatus === 'completed',
  };
};
