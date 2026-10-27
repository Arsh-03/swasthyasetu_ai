import type { SpokenDate } from '../format';

/**
 * Spoken scripts: what the app SAYS on a double tap, separate from what it SHOWS.
 * One file per language (en.ts, kn.ts, hi.ts), each written for that language, not translated
 * at runtime. Components pass data in; they never build spoken sentences themselves.
 *
 * Writing rules: short, full, friendly sentences (1-3); say what a thing is and what tapping it
 * does; no abbreviations, symbols or raw dates; card-level scripts carry only the essentials,
 * details (degrees, hospital block, agenda) belong to the child element's own script.
 */

export interface AppointmentFacts {
  /** Spoken doctor name, "Doctor Farah Khan" (no degrees). Empty if no doctor yet. */
  doctor: string;
  when: SpokenDate;
  /** Spoken time, "11:20 in the morning". */
  time: string;
  /** "skin, hair and nails" (from the department), if known. */
  topic?: string;
  /** "a skin specialist", if known. */
  specialist?: string;
  video: boolean;
  /** Hospital / clinic for in-person visits. */
  place?: string;
  rescheduled?: boolean;
  cancelled?: boolean;
  done?: boolean;
}

export type TabKey = 'home' | 'careplan' | 'chat' | 'records' | 'doctors';

export interface Scripts {
  /** First-run hint and the Settings toggle. */
  hint: { title: string; body: string; spoken: string; gotIt: string; replay: string };
  settings: { toggle: (on: boolean) => string; title: string; row: string; rowHint: string };

  header: {
    logo: string;
    language: (current: string) => string;
    profile: (name: string) => string;
    logout: string;
  };
  tabs: Record<TabKey, string> & { unread: (n: number) => string };
  chibi: { button: string; menuItem: (label: string) => string; menuTitle: string };

  common: {
    back: (to?: string) => string;
    close: string;
    cancel: string;
    seeAll: string;
    loading: string;
    stopReading: string;
    selected: (label: string) => string;
    toggle: (label: string, on: boolean) => string;
    input: (label: string, value: string, hint?: string) => string;
    tab: (label: string, active: boolean) => string;
    count: (title: string, n: number) => string;
  };

  home: {
    greeting: (name: string, today: string) => string;
    compliance: string;
    badgeAbdm: string;
    badgeDpdp: string;
    quickActions: string;
    otherUpcoming: (n: number) => string;
    seeAllAppointments: string;
    myDoctors: string;
    myRecords: string;
    medicines: string;
    privacy: string;
    heartRate: string;
    messageDoctor: string;
    sos: string;
  };

  appointment: {
    /** Card level: who, when, what for (no degrees, no hospital block, no agenda). */
    card: (a: AppointmentFacts) => string;
    /** A row in "Other upcoming" / schedule lists. */
    row: (a: AppointmentFacts) => string;
    eyebrow: string;
    doctor: (doctor: string) => string;
    qualification: (doctor: string, degrees: string[], subject: string, specialist?: string) => string;
    place: (place: string) => string;
    time: (time: string, when: SpokenDate) => string;
    date: (when: SpokenDate) => string;
    relative: (when: SpokenDate) => string;
    /** Department badge: "Dermatology. This department treats skin, hair and nails." */
    department: (name: string, topic?: string) => string;
    mode: (video: boolean) => string;
    rescheduled: string;
    agenda: (text: string) => string;
    joinCall: string;
    inPersonAt: (place: string) => string;
    cancel: string;
    none: string;
    loading: string;
    error: string;
    listen: string;
  };

  sos: { title: string; dial108: string; dial112: string; cancel: string };

  consent: {
    /** Whole request, read by the Listen button and the sheet body. */
    summary: (p: { doctor: string; record: string; purpose: string; minutes: number }) => string;
    timer: (minutes: number, seconds: number) => string;
    approve: (minutes: number) => string;
    decline: string;
  };

  call: {
    incoming: (doctor: string, video: boolean) => string;
    accept: string;
    acceptAudio: string;
    decline: string;
    mute: (muted: boolean) => string;
    camera: (off: boolean) => string;
    end: string;
    recordingAsk: (doctor: string) => string;
    recordingAllow: string;
    recordingDeny: string;
  };

  /** Card-level medicine scripts live in utils/medicationInfo (getMedicationSpeechText). */
  medication: {
    markTaken: (name: string) => string;
    taken: (name: string) => string;
  };

  records: {
    item: (p: { title: string; kind?: string; date?: string; source?: string; sharedWith?: string | null; minutesLeft?: number | null }) => string;
    upload: string;
    uploadPickFile: string;
    uploadFileSelected: (name: string) => string;
    uploadSubmit: (ready: boolean) => string;
    whoSaw: string;
    accessRow: (p: { doctor: string; record?: string; when?: string; purpose?: string; active?: boolean }) => string;
    revoke: (doctor: string) => string;
  };

  chat: {
    thread: (doctor: string, unread: number, last?: string) => string;
    message: (fromDoctor: boolean, doctor: string, text: string, time?: string) => string;
    input: string;
    send: string;
  };

  doctors: {
    card: (p: { doctor: string; specialist?: string; upcoming: number; unread: number }) => string;
    add: string;
    book: (doctor: string) => string;
    chat: (doctor: string) => string;
    requestVisit: (doctor: string) => string;
    remove: (doctor: string) => string;
    issue: (name: string, dept: string) => string;
    slot: (day: string, time: string, mode: string) => string;
    confirmBooking: (doctor: string, when: string) => string;
  };

  auth: {
    continueWithAbha: string;
    verifyAndSignIn: string;
    demoFill: string;
    createAccount: string;
    ashaSignIn: string;
    signUpSubmit: string;
    backToSignIn: string;
  };

  symptoms: {
    title: string;
    symptomToggle: (name: string, active: boolean) => string;
    voiceInput: (recording: boolean) => string;
    submit: (doctor?: string) => string;
  };

  meet: {
    title: string;
    find: string;
    askToJoin: (video: boolean, doctor?: string) => string;
    waiting: (doctor?: string) => string;
    cancelKnock: string;
  };

  summary: {
    offerTitle: string;
    offerBody: string;
    accept: string;
    decline: string;
    done: string;
  };

  heartRate: {
    intro: string;
    start: string;
    cancel: string;
    result: (bpm: number, good: boolean) => string;
    messageDoctor: string;
    again: string;
  };
}
