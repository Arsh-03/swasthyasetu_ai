import { useSyncExternalStore } from 'react';
import type { SupportedLanguage } from '../utils/translations';
import { haptic } from '../utils/haptics';
import * as engine from './engine';

/**
 * App-wide state for "double tap to hear" and the tap arbiter that tells a single tap from a
 * double tap. Kept outside React so hundreds of speakable texts can subscribe to just the bit
 * they need (am I the one speaking?) without re-rendering the whole tree.
 */

/** Two taps on the same element within this window are a double tap. Single-tap actions wait this long. */
export const DOUBLE_TAP_MS = 280;

export interface SpeechState {
  /** Element currently being read aloud (its speakable id), or null. */
  speakingId: string | null;
  /** Settings toggle. Off = no double-tap speech and no single-tap delay. */
  enabled: boolean;
  /** TalkBack / VoiceOver on: double tap belongs to the screen reader, so the gesture is off. */
  screenReader: boolean;
  /** App language (set by SpeechProvider). */
  lang: SupportedLanguage;
  /** Short message for the user, e.g. "Kannada voice is not installed". Language it was raised in. */
  notice: { kind: 'no-voice'; lang: SupportedLanguage } | null;
}

let state: SpeechState = { speakingId: null, enabled: true, screenReader: false, lang: 'en', notice: null };
const listeners = new Set<() => void>();

export const getSpeechState = () => state;

export const setSpeechState = (patch: Partial<SpeechState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Subscribe to one derived value of the speech state. */
export function useSpeechSelector<T>(select: (s: SpeechState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

/** Is the double-tap gesture active right now (enabled and no screen reader)? */
export const gestureActive = (s: SpeechState = state) => s.enabled && !s.screenReader;

// ------------------------------------------------------------------------------------------ speaking

let noticeTimer: ReturnType<typeof setTimeout> | null = null;
/** Called once when the current reading ends for any reason (finished, stopped, replaced). */
let currentDone: (() => void) | null = null;

const endCurrent = () => {
  const done = currentDone;
  currentDone = null;
  done?.();
};

/** Read `text` aloud for element `id`. Speaking the same element again stops it (toggle). */
export const speakFor = (id: string, text: string, onDone?: () => void) => {
  if (state.speakingId === id) {
    stopSpeech();
    return;
  }
  endCurrent();
  const result = engine.speak(text, state.lang, {
    onDone: () => {
      if (state.speakingId === id) setSpeechState({ speakingId: null });
      endCurrent();
    },
  });
  if (result === 'ok') {
    currentDone = onDone ?? null;
    setSpeechState({ speakingId: id, notice: null });
  } else {
    setSpeechState({ speakingId: null });
    onDone?.();
    if (result === 'no-voice') {
      setSpeechState({ notice: { kind: 'no-voice', lang: state.lang } });
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setSpeechState({ notice: null }), 5000);
    }
  }
};

/** Stop any speech (new screen, language change, stop button). */
export const stopSpeech = () => {
  engine.stop();
  if (state.speakingId !== null) setSpeechState({ speakingId: null });
  endCurrent();
};

// --------------------------------------------------------------------------------------- tap arbiter

export interface TapTarget {
  /** Speakable id of the element that was touched. */
  id: string;
  /** Script to read on a double tap (evaluated only then, so it reflects current data). */
  speech: () => string;
  /** Single-tap action (the element's own, or its nearest ancestor's). None = plain content. */
  action?: () => void;
}

let pending: { id: string; timer: ReturnType<typeof setTimeout> } | null = null;
let lastTap: { id: string; at: number } | null = null;
/** After a double tap, further quick taps on the same element (a triple tap) are ignored. */
let quietUntil: { id: string; until: number } | null = null;

const cancelPending = () => {
  if (pending) clearTimeout(pending.timer);
  pending = null;
};

/**
 * Route one tap. Gesture off: the action runs at once. Gesture on: the action waits
 * DOUBLE_TAP_MS; a second tap on the same element in that time cancels it and speaks instead,
 * so a double tap can never run the action (SOS, Join call, consent included).
 */
export const routeTap = (target: TapTarget) => {
  if (!gestureActive()) {
    target.action?.();
    return;
  }

  const now = Date.now();
  if (quietUntil && quietUntil.id === target.id && now < quietUntil.until) {
    quietUntil.until = now + DOUBLE_TAP_MS;
    return;
  }

  if (lastTap && lastTap.id === target.id && now - lastTap.at < DOUBLE_TAP_MS) {
    cancelPending();
    lastTap = null;
    quietUntil = { id: target.id, until: now + DOUBLE_TAP_MS };
    haptic.tap();
    speakFor(target.id, target.speech());
    return;
  }

  // A tap on a different element replaces any tap still waiting
  cancelPending();
  lastTap = { id: target.id, at: now };

  if (target.action) {
    const run = target.action;
    pending = {
      id: target.id,
      timer: setTimeout(() => {
        pending = null;
        run();
      }, DOUBLE_TAP_MS),
    };
  } else if (state.speakingId === target.id) {
    // Single tap on plain content that is being read: stop reading
    pending = {
      id: target.id,
      timer: setTimeout(() => {
        pending = null;
        stopSpeech();
      }, DOUBLE_TAP_MS),
    };
  }
};
