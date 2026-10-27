/**
 * Double tap to hear: one engine, one gesture, one place for spoken words.
 *
 *  - Speakable: use instead of Pressable for anything tappable (buttons, cards, rows, tabs).
 *  - AppText: speakable by default; pass `speech` for a script instead of the visible text.
 *  - useScripts(): the spoken sentences for the app language (scripts/en.ts, kn.ts, hi.ts).
 *  - format.ts: natural dates, times, doctor names and the fallback text cleaner.
 */
export { Speakable, AtomicSpeakableScope, type SpeakableProps, type SpeechSource } from './Speakable';
export { useScripts, appointmentFacts, SCRIPTS, type Scripts, type AppointmentFacts, type TabKey } from './scripts';
export { speakFor, stopSpeech, routeTap, useSpeechSelector, DOUBLE_TAP_MS } from './store';
export * from './format';
