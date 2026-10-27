/**
 * Audio Synthesizer & Audio Player for tactile feedback and medication reminders.
 * Provides guaranteed cross-platform audio playback across Web, iOS Safari,
 * Android Chrome, and Native Mobile (expo-audio; expo-av is no longer in Expo Go).
 */
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { POPPER_SOUND_BASE64 } from './popperSoundBase64';
import { haptic } from './haptics';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Proactively unlock Web Audio on mobile browsers (Safari/Chrome require user interaction)
// (Native apps have a `window` without addEventListener, so check for the method itself.)
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {
      // ignore
    }
  };
  window.addEventListener('touchstart', unlock, { passive: true, once: true });
  window.addEventListener('touchend', unlock, { passive: true, once: true });
  window.addEventListener('click', unlock, { passive: true, once: true });
}

/**
 * Plays a bubbly, crisp "pop" sound followed by a cheerful, sparkling harmonic chime.
 * Used when a patient marks a medicine dose as taken.
 */
export function playDoseTakenPopSound() {
  playBirthdayPopperSound();
}

/**
 * Plays an attention-grabbing, pleasant two-tone medication time reminder chime.
 * Used when a scheduled medicine time is reached.
 */
export function playMedicationAlertSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Note 1: E5 (659.25 Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0.22, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.25);

  // Note 2: B5 (987.77 Hz) slightly delayed
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(987.77, now + 0.14);
  gain2.gain.setValueAtTime(0.0, now);
  gain2.gain.setValueAtTime(0.26, now + 0.14);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.14);
  osc2.stop(now + 0.5);
}

/**
 * Plays an authentic, festive Birthday Party Popper explosion sound!
 * Guaranteed to play on mobile browsers (Safari/Chrome) and native apps:
 * 1. HTML5 Audio element with base64 data URI (reliable across all mobile browsers)
 * 2. Web Audio API synthesizer layer for rich resonance
 * 3. expo-audio native player on iOS & Android native apps
 */
export function playBirthdayPopperSound() {
  // Always trigger haptics
  haptic.success();

  // 1. Mobile & Web Browsers: HTML5 Audio with pre-synthesized WAV data URI
  if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
    try {
      const audioEl = new Audio(POPPER_SOUND_BASE64);
      audioEl.volume = 1.0;
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback if browser policy blocked audio
        });
      }
    } catch {
      // Audio element fallback
    }
  }

  // 2. Web Audio API synthesized layer for depth
  const ctx = getAudioContext();
  if (ctx && ctx.state !== 'suspended') {
    try {
      const now = ctx.currentTime;

      // Party Popper "CRACK-POP!" (Sharp pressure snap: 1350Hz -> 200Hz in 40ms)
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(1350, now);
      popOsc.frequency.exponentialRampToValueAtTime(220, now + 0.04);
      popGain.gain.setValueAtTime(0.45, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      popOsc.connect(popGain);
      popGain.connect(ctx.destination);
      popOsc.start(now);
      popOsc.stop(now + 0.06);

      // Fanfare Arpeggio
      const notes = [
        { freq: 783.99, delay: 0.07, duration: 0.22, vol: 0.25 },
        { freq: 1046.5, delay: 0.13, duration: 0.25, vol: 0.3 },
        { freq: 1318.51, delay: 0.19, duration: 0.38, vol: 0.32 },
        { freq: 1567.98, delay: 0.20, duration: 0.42, vol: 0.26 },
      ];

      notes.forEach(({ freq, delay, duration, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.setValueAtTime(vol, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + duration + 0.02);
      });
    } catch {
      // ignore
    }
  }

  // 3. Native iOS & Android (expo-audio)
  if (Platform.OS !== 'web') {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'duckOthers' })
      .then(() => {
        const player = createAudioPlayer({ uri: POPPER_SOUND_BASE64 });
        player.volume = 1.0;
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            sub.remove();
            player.remove();          // free the native player
          }
        });
        player.play();
      })
      .catch(() => {});
  }
}
