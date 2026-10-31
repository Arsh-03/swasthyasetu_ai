import { enArticle } from '../format';
import type { AppointmentFacts, Scripts } from './types';

const on = (w: AppointmentFacts['when']) => (w.when === 'later' || w.when === 'past' ? `on ${w.phrase}` : w.phrase);
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const num = (n: number) => SMALL[n] ?? String(n);

export const en: Scripts = {
  hint: {
    title: 'Double tap anything to hear it',
    body: 'Tap once to use the app as usual. Tap twice quickly on any card, button or text, and the app will explain it out loud.',
    spoken: 'Welcome. Double tap anything on the screen to hear what it is. Tap once to use it as usual.',
    gotIt: 'Got it',
    replay: 'Hear this again',
  },
  settings: {
    title: 'Settings',
    row: 'Double tap to hear',
    rowHint: 'Tap twice on anything to hear it read aloud',
    toggle: (isOn) =>
      isOn
        ? 'Double tap to hear is on. Tap to turn it off.'
        : 'Double tap to hear is off. Tap to turn it on, so the app can explain things out loud.',
  },

  header: {
    logo: 'SwasthyaSetu, your health app.',
    language: (current) => `Language. It is set to ${current}. Tap to change it.`,
    profile: (name) => (name ? `Your profile, ${name}. Tap to tell the doctor how you feel.` : 'Your profile.'),
    logout: 'Log out of your account.',
  },
  tabs: {
    home: 'Today. Your home page with your next appointment.',
    careplan: 'Medications. See the medicines you need to take.',
    chat: 'Chat. Send messages to your doctor.',
    records: 'Records. Your reports and health documents.',
    doctors: 'Doctors. Find and book a doctor.',
    unread: (n) => (n > 0 ? ` You have ${plural(n, 'new message', 'new messages')}.` : ''),
  },
  chibi: {
    button: 'Your health assistant. Tap to ask for help.',
    menuTitle: 'Your health assistant. Choose what you want to do.',
    menuItem: (label) => `${label}. Tap to do this.`,
  },

  common: {
    back: (to) => (to ? `Go back to ${to}.` : 'Go back to the previous page.'),
    close: 'Close this.',
    cancel: 'Cancel, and go back without changing anything.',
    seeAll: 'See all. Tap to see the full list.',
    loading: 'Loading. Please wait.',
    stopReading: 'Stop reading.',
    selected: (label) => `${label}. This is selected.`,
    toggle: (label, isOn) => `${label}. It is ${isOn ? 'on' : 'off'}. Tap to turn it ${isOn ? 'off' : 'on'}.`,
    input: (label, value, hint) =>
      `${label}. ${value ? `You have entered: ${value}.` : 'This is empty.'}${hint ? ` ${hint}` : ''} Tap here to type.`,
    tab: (label, active) => (active ? `${label}. You are on this tab.` : `${label}. Tap to open.`),
    count: (title, n) => `${title}. There ${n === 1 ? 'is' : 'are'} ${num(n)}.`,
  },

  home: {
    greeting: (name, today) => `Hello${name ? ` ${name}` : ''}. Today is ${today}.`,
    compliance: 'Your health records are kept private and safe, following the Government of India health data rules.',
    badgeAbdm: 'This app is part of the Ayushman Bharat Digital Mission, the government health records system.',
    badgeDpdp: 'Your data is protected under India’s data protection law. Nobody can see your records without your permission.',
    quickActions: 'Quick actions. Shortcuts to the things you use most.',
    otherUpcoming: (n) =>
      `You have ${num(n)} more upcoming ${n === 1 ? 'appointment' : 'appointments'}. Tap See all to view them.`,
    seeAllAppointments: 'See all your appointments.',
    myDoctors: 'My doctors. See your doctors and book a visit.',
    myRecords: 'My records. Your test reports, prescriptions and scans.',
    medicines: 'Medicines. See which medicines to take today, and when.',
    privacy: 'Privacy. See which doctors have looked at your records.',
    heartRate: 'Heart rate. Check your pulse using your phone camera.',
    messageDoctor: 'Message your doctor. Send a question to your doctor.',
    sos: 'Emergency help. Tap this only in an emergency, to call an ambulance.',
  },

  appointment: {
    card: (a) => {
      if (a.cancelled) return `Your appointment with ${a.doctor || 'the doctor'} ${on(a.when)} was cancelled.`;
      if (a.when.when === 'past')
        return `Your appointment with ${a.doctor || 'the doctor'} was ${on(a.when)}, at ${a.time}.`;
      const moved = a.rescheduled ? 'Your doctor has moved this appointment to a new time. ' : '';
      const who = a.doctor ? ` with ${a.doctor}` : '';
      const why = a.topic ? `, for ${a.topic}` : '';
      const how = a.video ? ' It is a video call, so you can join from home.' : a.place ? ` It is at ${a.place}.` : '';
      return `${moved}You have an appointment${who} ${on(a.when)}, at ${a.time}${why}.${how}`;
    },
    row: (a) => {
      if (a.cancelled) return `Cancelled. Your appointment with ${a.doctor || 'the doctor'} ${on(a.when)}.`;
      if (a.done) return `Done. You saw ${a.doctor || 'the doctor'} ${on(a.when)}.`;
      const kind = a.video ? 'a video appointment' : 'an appointment at the hospital';
      const spec = a.specialist ? `, ${a.specialist}` : '';
      return `${a.when.relative.charAt(0).toUpperCase()}${a.when.relative.slice(1)} at ${a.time}, you have ${kind} with ${a.doctor || 'your doctor'}${spec}.`;
    },
    eyebrow: 'Your next appointment.',
    doctor: (doctor) => `Your doctor is ${doctor}.`,
    qualification: (doctor, degrees, subject, specialist) => {
      const deg = degrees.length ? `${enArticle(degrees[0])} ${degrees.join(' and ')} ${degrees.length > 1 ? 'degrees' : 'degree'}` : 'a degree';
      const field = subject ? ` in ${subject}` : '';
      const meaning = specialist ? ` This means the doctor is ${specialist}.` : '';
      return `${doctor} has ${deg}${field}.${meaning}`;
    },
    place: (place) => `This is at ${place}.`,
    time: (time, when) => `Your appointment is at ${time}, ${on(when)}.`,
    date: (when) => `The date is ${when.phrase}.`,
    relative: (when) =>
      when.when === 'past' ? 'This appointment has already happened.' : `Your appointment is ${on(when)}.`,
    department: (name, topic) => (topic ? `${name}. This department treats ${topic}.` : `${name} department.`),
    mode: (video) =>
      video ? 'This is a video call. You can join from your phone at home.' : 'This is an in-person visit. You need to go to the hospital.',
    rescheduled: 'Your doctor has moved this appointment to a new time. Please check the new time.',
    agenda: (text) => `What the doctor will look at: ${text}`,
    joinCall: 'This button starts your video call with the doctor. Tap it at appointment time.',
    inPersonAt: (place) => `Please go to ${place} for this visit.`,
    cancel: 'Cancel this appointment. You will be asked to confirm.',
    none: 'You have no appointment booked right now.',
    loading: 'Loading your next appointment. Please wait.',
    error: 'We could not load your appointment. Please check your internet connection.',
    listen: 'Listen. Tap to hear about your appointment.',
  },

  sos: {
    title: 'Emergency help. Choose who to call.',
    dial108: 'Call 108 for an ambulance.',
    dial112: 'Call 112, the national emergency number for police, fire and ambulance.',
    cancel: 'Cancel. Close this without calling anyone.',
  },

  consent: {
    summary: ({ doctor, record, purpose, minutes }) =>
      `${doctor} is asking to see your ${record}, for this reason: ${purpose}. If you allow it, they can see it for ${minutes} minutes only. You can say yes or no.`,
    timer: (m, s) => `This request ends in ${m} minutes and ${s} seconds.`,
    approve: (minutes) => `Allow. Tap to let the doctor see this record for ${minutes} minutes.`,
    decline: 'Decline. Tap to say no. The doctor will not see your record.',
  },

  call: {
    incoming: (doctor, video) => `${doctor} is calling you${video ? ' on video' : ''}.`,
    accept: 'Answer the call with video.',
    acceptAudio: 'Answer with voice only, without your camera.',
    decline: 'Decline the call.',
    mute: (muted) => (muted ? 'Your microphone is off. Tap to turn it on.' : 'Your microphone is on. Tap to mute it.'),
    camera: (off) => (off ? 'Your camera is off. Tap to turn it on.' : 'Your camera is on. Tap to turn it off.'),
    end: 'End the call.',
    recordingAsk: (doctor) => `${doctor} would like to record the sound of this call, to write notes of your visit. You can say yes or no.`,
    recordingAllow: 'Allow recording.',
    recordingDeny: 'Do not record.',
  },

  medication: {
    markTaken: (name) => `Tap when you have taken ${name}.`,
    taken: (name) => `You have taken ${name}. Tap to undo.`,
  },

  records: {
    item: ({ title, kind, date, source, sharedWith }) =>
      `${title}.${kind ? ` This is ${enArticle(kind)} ${kind}.` : ''}${date ? ` Added on ${date}.` : ''}${source ? ` From ${source}.` : ''}${sharedWith ? ` Shared with ${sharedWith}.` : ''}`,
    upload: 'Add a report. Take a photo or choose a file to save in your records.',
    uploadPickFile: 'Choose file. Select a medical report, prescription or scan from your phone.',
    uploadFileSelected: (name) => `Selected file: ${name}. Tap to change.`,
    uploadSubmit: (ready) => (ready ? 'Upload and save this report securely in your vault.' : 'Please select a file first before uploading.'),
    whoSaw: 'See which doctors have looked at your records.',
    accessRow: ({ doctor, record, when, purpose, active }) =>
      `${doctor} looked at ${record || 'your records'}${when ? ` on ${when}` : ''}.${purpose ? ` The reason was: ${purpose}.` : ''}${active ? ' They can still see it.' : ''}`,
    revoke: (doctor) => `Stop ${doctor} from seeing your records.`,
  },

  chat: {
    thread: (doctor, unread, last) =>
      `Messages with ${doctor}.${unread ? ` ${plural(unread, 'new message', 'new messages')}.` : ''}${last ? ` Last message: ${last}` : ''}`,
    message: (fromDoctor, doctor, text, time) => `${fromDoctor ? `${doctor} said` : 'You said'}${time ? ` at ${time}` : ''}: ${text}`,
    input: 'Type your message to the doctor here.',
    send: 'Send your message.',
  },

  doctors: {
    card: ({ doctor, specialist, upcoming, unread }) =>
      `${doctor}${specialist ? `, ${specialist}` : ''}.${upcoming ? ` You have ${plural(upcoming, 'upcoming appointment', 'upcoming appointments')}.` : ''}${unread ? ` ${plural(unread, 'new message', 'new messages')}.` : ''}`,
    add: 'Add a doctor. Find a doctor for a health problem and book a visit.',
    book: (doctor) => `Book a visit with ${doctor}.`,
    chat: (doctor) => `Send a message to ${doctor}.`,
    requestVisit: (doctor) => `Ask ${doctor} for a video visit now.`,
    remove: (doctor) => `Remove ${doctor} from your list of doctors.`,
    issue: (name, dept) => `${name}. Suggested department: ${dept}. Tap to choose this problem.`,
    slot: (day, time, mode) => `${day} at ${time}, ${mode === 'video' ? 'video consultation' : 'in-person hospital visit'}. Tap to choose this time.`,
    confirmBooking: (doctor, when) => `Confirm appointment with ${doctor} for ${when}.`,
  },

  auth: {
    continueWithAbha: 'Continue with Abha. Tap to receive a one-time verification code on your phone.',
    verifyAndSignIn: 'Verify code and sign in to your health account.',
    demoFill: 'Fill sample account details for demonstration.',
    createAccount: 'New here? Tap to create your patient account.',
    ashaSignIn: 'Sign in as an ASHA healthcare worker.',
    signUpSubmit: 'Create your SwasthyaSetu patient account.',
    backToSignIn: 'Go back to sign in.',
  },

  symptoms: {
    title: 'Tell the doctor what symptoms you are feeling.',
    symptomToggle: (name, active) => `${name}.${active ? ' Selected. Tap to remove.' : ' Tap to select this symptom.'}`,
    voiceInput: (recording) => (recording ? 'Listening. Speak your symptoms into the microphone.' : 'Tap to speak your symptoms aloud instead of typing.'),
    submit: (doctor) => (doctor ? `Send your symptoms to ${doctor} and request a video consultation.` : 'Submit your symptoms for doctor consultation.'),
  },

  meet: {
    title: 'Consultation meeting room.',
    find: 'Find consultation room by meeting code.',
    askToJoin: (video, doctor) => `Ask to join ${video ? 'video' : 'audio'} consultation${doctor ? ` with ${doctor}` : ''}.`,
    waiting: (doctor) => `Waiting for ${doctor || 'the doctor'} to admit you into the consultation room.`,
    cancelKnock: 'Cancel waiting and leave.',
  },

  summary: {
    offerTitle: 'Consultation summary.',
    offerBody: 'Would you like an AI summary of your visit and medicines?',
    accept: 'Yes, save this consultation summary to my records.',
    decline: 'No, do not save this summary.',
    done: 'Done. Return to your health plan.',
  },

  heartRate: {
    intro: 'Check your heart rate pulse using your phone camera.',
    start: 'Start measuring your heart rate. Place your fingertip gently over the camera lens.',
    cancel: 'Stop measuring heart rate.',
    result: (bpm, good) => `Your estimated heart rate is ${bpm} beats per minute.${good ? ' Reading was clear.' : ' Fair reading, rest and try again if needed.'}`,
    messageDoctor: 'Send this heart rate reading to your doctor.',
    again: 'Measure heart rate again.',
  },
};
