import { speak, stopSpeaking } from '../../utils/speech';
import type { SupportedLanguage } from '../../utils/translations';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'unsupported';

export type ChibiAction =
  | { type: 'navigate'; screen: 'home' | 'careplan' | 'chat' | 'heartrate' | 'whosaw' | 'records' | 'doctors' | 'join'; feedback: string }
  | { type: 'sos'; feedback: string }
  | { type: 'change_language'; lang: SupportedLanguage; feedback: string }
  | { type: 'screen_summary'; feedback: string }
  | { type: 'help'; feedback: string }
  | { type: 'unknown'; rawText: string; feedback: string };

export interface ChibiVoiceState {
  status: VoiceStatus;
  interimTranscript: string;
  finalTranscript: string;
  lastReply: string;
  errorMessage: string | null;
  isMuted: boolean;
  language: SupportedLanguage;
}

type StateListener = (state: ChibiVoiceState) => void;
type ActionHandler = (action: ChibiAction, rawText: string) => void;

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

const getSpeechRecognitionCtor = (): any => {
  if (typeof window === 'undefined') return null;
  const win = window as IWindowWithSpeech;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
};

class ChibiVoiceService {
  private recognition: any = null;
  private isListening = false;
  private shouldKeepListening = false;
  private restartTimeout: any = null;
  private commandTimeout: any = null;
  private listeners: Set<StateListener> = new Set();
  private actionHandlers: Set<ActionHandler> = new Set();

  private state: ChibiVoiceState = {
    status: 'idle',
    interimTranscript: '',
    finalTranscript: '',
    lastReply: '',
    errorMessage: null,
    isMuted: false,
    language: 'en',
  };

  constructor() {
    // Check initial environment support
    if (typeof window !== 'undefined') {
      const ctor = getSpeechRecognitionCtor();
      if (!ctor) {
        this.state.status = 'unsupported';
        this.state.errorMessage = 'Browser speech recognition is not available. Please use Google Chrome or Edge.';
      }
    }
  }

  private getSpeechLangCode(lang: SupportedLanguage): string {
    switch (lang) {
      case 'hi':
        return 'hi-IN';
      case 'kn':
        return 'kn-IN';
      case 'en':
      default:
        return 'en-IN';
    }
  }

  public setLanguage(lang: SupportedLanguage) {
    if (this.state.language === lang) return;
    this.state.language = lang;
    this.notify();

    // If currently listening, seamlessly recreate recognition with the new language
    if (this.isListening && this.recognition) {
      this.stopListening();
      setTimeout(() => {
        this.startListening();
      }, 200);
    }
  }

  /**
   * Request microphone permission explicitly via getUserMedia to prevent browser silent drops.
   */
  private async ensureMicrophonePermission(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop audio tracks after obtaining permission
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err: any) {
        console.warn('[CHIBI Voice] getUserMedia error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this.updateState({
            status: 'error',
            errorMessage: 'Microphone permission blocked. Please allow microphone access in your browser address bar.',
          });
          return false;
        }
      }
    }
    return true;
  }

  public async startListening() {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      this.updateState({
        status: 'unsupported',
        errorMessage: 'Speech recognition is supported in Google Chrome, Edge, and Safari.',
      });
      return;
    }

    // Stop ongoing speech synthesis first so CHIBI doesn't hear itself
    stopSpeaking();

    // Clean up any stale active instance
    this.cleanupRecognition();

    // Ensure mic permissions are granted
    const permitted = await this.ensureMicrophonePermission();
    if (!permitted) return;

    this.shouldKeepListening = true;

    try {
      const rec = new SpeechRecognitionCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this.getSpeechLangCode(this.state.language);

      rec.onstart = () => {
        console.log('[CHIBI Voice] Microphone listening active for:', rec.lang);
        this.isListening = true;
        this.updateState({
          status: 'listening',
          errorMessage: null,
          interimTranscript: '',
        });
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        if (interim) {
          this.updateState({ interimTranscript: interim });
        }

        if (final.trim()) {
          const cleanFinal = final.trim();
          console.log('[CHIBI Voice] Recognized final speech:', cleanFinal);

          this.updateState({
            finalTranscript: cleanFinal,
            interimTranscript: '',
            status: 'processing',
          });

          // Debounce execution slightly to allow user to complete multi-word sentence
          if (this.commandTimeout) clearTimeout(this.commandTimeout);
          this.commandTimeout = setTimeout(() => {
            this.stopListening();
            this.processCommand(cleanFinal);
          }, 450);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('[CHIBI Voice] Recognition error:', event.error);

        // Ignore benign pauses and aborts
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.shouldKeepListening = false;
          this.isListening = false;
          this.updateState({
            status: 'error',
            errorMessage: 'Microphone permission denied. Please allow microphone in browser settings.',
          });
          return;
        }

        if (event.error === 'network') {
          this.updateState({
            errorMessage: 'Voice network error. Please check your internet connection.',
          });
          return;
        }

        this.updateState({
          errorMessage: `Voice engine: ${event.error}`,
        });
      };

      rec.onend = () => {
        this.isListening = false;
        console.log('[CHIBI Voice] Recognition instance ended. KeepListening:', this.shouldKeepListening);

        if (this.shouldKeepListening) {
          // Restart with a fresh instance after short delay (browser requires fresh instance after onend)
          if (this.restartTimeout) clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.shouldKeepListening) {
              this.startListening();
            }
          }, 300);
        } else if (this.state.status !== 'speaking' && this.state.status !== 'processing') {
          this.updateState({ status: 'idle', interimTranscript: '' });
        }
      };

      this.recognition = rec;
      rec.start();
    } catch (e: any) {
      console.warn('[CHIBI Voice] Failed to start recognition instance:', e);
      this.isListening = false;
      this.updateState({
        status: 'error',
        errorMessage: e?.message || 'Could not start microphone.',
      });
    }
  }

  public stopListening() {
    this.shouldKeepListening = false;
    this.isListening = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
      this.commandTimeout = null;
    }

    this.cleanupRecognition();

    if (this.state.status === 'listening') {
      this.updateState({ status: 'idle', interimTranscript: '' });
    }
  }

  public toggleListening() {
    if (this.isListening || this.shouldKeepListening) {
      this.stopListening();
    } else {
      void this.startListening();
    }
  }

  private cleanupRecognition() {
    if (this.recognition) {
      try {
        // Detach handlers to prevent zombie onend triggers
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // Ignored
      }
      this.recognition = null;
    }
  }

  public setMuted(muted: boolean) {
    this.updateState({ isMuted: muted });
    if (muted) {
      stopSpeaking();
    }
  }

  public speakReply(text: string, lang?: SupportedLanguage) {
    const speakLang = lang || this.state.language;
    this.updateState({ lastReply: text, status: 'speaking' });

    if (this.state.isMuted) {
      setTimeout(() => {
        this.updateState({ status: 'idle' });
      }, 500);
      return;
    }

    const spoken = speak(text, speakLang, () => {
      this.updateState({ status: 'idle' });
    });

    if (!spoken) {
      this.updateState({ status: 'idle' });
    }
  }

  /**
   * Natural Language Intent parsing for Patient App in English, Hindi, and Kannada.
   */
  public parseIntent(rawText: string, currentLang: SupportedLanguage): ChibiAction {
    const text = rawText.toLowerCase().trim();

    // 1. Language switching commands
    if (text.includes('hindi') || text.includes('हिंदी')) {
      return { type: 'change_language', lang: 'hi', feedback: 'भाषा बदलकर हिंदी कर दी गई है।' };
    }
    if (text.includes('kannada') || text.includes('ಕನ್ನಡ')) {
      return { type: 'change_language', lang: 'kn', feedback: 'ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ.' };
    }
    if (text.includes('english') || text.includes('अंग्रेजी') || text.includes('ಇಂಗ್ಲಿಷ್')) {
      return { type: 'change_language', lang: 'en', feedback: 'Switched language to English.' };
    }

    // 2. Emergency / SOS
    if (
      text.includes('emergency') ||
      text.includes('sos') ||
      text.includes('ambulance') ||
      text.includes('आपातकाल') ||
      text.includes('इमरजेंसी') ||
      text.includes('खतरा') ||
      text.includes('मदद चाहिए') ||
      text.includes('ತುರ್ತು') ||
      text.includes('ಆಂಬ್ಯುಲೆನ್ಸ್') ||
      text.includes('ಸಹಾಯ ಬೇಕು')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'इमरजेंसी एसओएस खोला जा रहा है।'
          : currentLang === 'kn'
          ? 'ತುರ್ತು ಎಸ್‌ಒಎಸ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ.'
          : 'Opening Emergency SOS alert.';
      return { type: 'sos', feedback };
    }

    // 3. Medicines / Care Plan
    if (
      text.includes('medicine') ||
      text.includes('medication') ||
      text.includes('care plan') ||
      text.includes('careplan') ||
      text.includes('pill') ||
      text.includes('tablets') ||
      text.includes('prescription') ||
      text.includes('dose') ||
      text.includes('दवा') ||
      text.includes('दवाई') ||
      text.includes('दवाइयां') ||
      text.includes('गोली') ||
      text.includes('खुराक') ||
      text.includes('ಔಷಧ') ||
      text.includes('ಔಷಧಿ') ||
      text.includes('ಮಾತ್ರೆ') ||
      text.includes('ಮಾತ್ರೆಗಳು')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'आपकी आज की दवाइयों का शेड्यूल खोल रहा हूँ।'
          : currentLang === 'kn'
          ? 'ನಿಮ್ಮ ಇಂದಿನ ಔಷಧಿಗಳ ವೇಳಾಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.'
          : 'Opening your medications schedule for today.';
      return { type: 'navigate', screen: 'careplan', feedback };
    }

    // 4. Heart Rate Monitor
    if (
      text.includes('heart rate') ||
      text.includes('heartbeat') ||
      text.includes('pulse') ||
      text.includes('bpm') ||
      text.includes('vital') ||
      text.includes('धड़कन') ||
      text.includes('हार्ट रेट') ||
      text.includes('नब्ज') ||
      text.includes('हार्ट') ||
      text.includes('ಹೃದಯ ಬಡಿತ') ||
      text.includes('ನಾಡಿ ಮಿಡಿತ') ||
      text.includes('ಹೃದಯ')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'हार्ट रेट और पल्स मॉनिटर खोल रहा हूँ।'
          : currentLang === 'kn'
          ? 'ಹೃದಯ ಬಡಿತ ತಪಾಸಣೆಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.'
          : 'Opening heart rate monitor.';
      return { type: 'navigate', screen: 'heartrate', feedback };
    }

    // 5. Chat with Doctor
    if (
      text.includes('chat') ||
      text.includes('message') ||
      text.includes('doctor message') ||
      text.includes('talk to doctor') ||
      text.includes('inbox') ||
      text.includes('चैट') ||
      text.includes('संदेश') ||
      text.includes('मैसेज') ||
      text.includes('बात करो') ||
      text.includes('डॉक्टर से बात') ||
      text.includes('ಚಾಟ್') ||
      text.includes('ಸಂದೇಶ') ||
      text.includes('ವೈದ್ಯರಿಗೆ ಸಂದೇಶ')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'डॉक्टर के साथ चैट और संदेश खोल रहा हूँ।'
          : currentLang === 'kn'
          ? 'ವೈದ್ಯರೊಂದಿಗಿನ ಸಂದೇಶಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.'
          : 'Opening messages with your doctor.';
      return { type: 'navigate', screen: 'chat', feedback };
    }

    // 6. My Doctors & Book Appointment
    if (
      text.includes('my doctor') ||
      text.includes('doctors') ||
      text.includes('find doctor') ||
      text.includes('book') ||
      text.includes('appointment') ||
      text.includes('specialist') ||
      text.includes('डॉक्टर') ||
      text.includes('मेरे डॉक्टर') ||
      text.includes('अपॉइंटमेंट') ||
      text.includes('मुलाकात') ||
      text.includes('ವೈದ್ಯರು') ||
      text.includes('ನನ್ನ ವೈದ್ಯರು') ||
      text.includes('ಅಪಾಯಿಂಟ್ಮೆಂಟ್')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'आपके डॉक्टरों की सूची और अपॉइंटमेंट खोल रहा हूँ।'
          : currentLang === 'kn'
          ? 'ನಿಮ್ಮ ವೈದ್ಯರ ಪಟ್ಟಿ ಮತ್ತು ಅಪಾಯಿಂಟ್ಮೆಂಟ್‌ಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.'
          : 'Opening My Doctors and appointments.';
      return { type: 'navigate', screen: 'doctors', feedback };
    }

    // 7. Medical Records Locker
    if (
      text.includes('record') ||
      text.includes('records') ||
      text.includes('report') ||
      text.includes('reports') ||
      text.includes('locker') ||
      text.includes('document') ||
      text.includes('lab result') ||
      text.includes('रिकॉर्ड') ||
      text.includes('दस्तावेज़') ||
      text.includes('रिपोर्ट') ||
      text.includes('जाँच') ||
      text.includes('कागज़ात') ||
      text.includes('ದಾಖಲೆ') ||
      text.includes('ದಾಖಲೆಗಳು') ||
      text.includes('ವರದಿ') ||
      text.includes('ವರದಿಗಳು')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'आपके मेडिकल रिकॉर्ड और रिपोर्ट्स खोल रहा हूँ।'
          : currentLang === 'kn'
          ? 'ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ದಾಖಲೆಗಳು ಮತ್ತು ವರದಿಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.'
          : 'Opening your medical records locker.';
      return { type: 'navigate', screen: 'records', feedback };
    }

    // 8. Who Saw My Records / Privacy
    if (
      text.includes('who saw') ||
      text.includes('who seen') ||
      text.includes('privacy') ||
      text.includes('audit') ||
      text.includes('consent') ||
      text.includes('security') ||
      text.includes('किसने देखा') ||
      text.includes('प्राइवेसी') ||
      text.includes('गोपनीयता') ||
      text.includes('सुरक्षा') ||
      text.includes('ಯಾರು ನೋಡಿದರು') ||
      text.includes('ಖಾಸಗಿತನ') ||
      text.includes('ಭದ್ರತೆ')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'रिकॉर्ड एक्सेस और गोपनीयता लॉग खोल रहा हूँ।'
          : currentLang === 'kn'
          ? 'ದಾಖಲೆ ಪ್ರವೇಶ ಮತ್ತು ಖಾಸಗಿತನದ ವಿವರಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.'
          : 'Opening Who Saw My Records privacy log.';
      return { type: 'navigate', screen: 'whosaw', feedback };
    }

    // 9. Join Consultation / Video Call
    if (
      text.includes('join') ||
      text.includes('video call') ||
      text.includes('meeting') ||
      text.includes('consultation') ||
      text.includes('call') ||
      text.includes('कॉल') ||
      text.includes('वीडियो कॉल') ||
      text.includes('परामर्श में जुड़ें') ||
      text.includes('मीटिंग') ||
      text.includes('ಕರೆ') ||
      text.includes('ವೀಡಿಯೊ ಕರೆ') ||
      text.includes('ಸಮಾಲೋಚನೆಗೆ ಸೇರಿ')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'वीडियो परामर्श स्क्रीन पर जा रहे हैं।'
          : currentLang === 'kn'
          ? 'ವೀಡಿಯೊ ಸಮಾಲೋಚನೆಗೆ ಸೇರ್ಪಡೆಗೊಳ್ಳಲಾಗುತ್ತಿದೆ.'
          : 'Taking you to join consultation.';
      return { type: 'navigate', screen: 'join', feedback };
    }

    // 10. Home / Dashboard
    if (
      text.includes('home') ||
      text.includes('main') ||
      text.includes('dashboard') ||
      text.includes('back to home') ||
      text.includes('होम') ||
      text.includes('मुख्य') ||
      text.includes('घर') ||
      text.includes('ಮುಖಪುಟ') ||
      text.includes('ಹೋಮ್')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'मुख्य पृष्ठ पर जा रहे हैं।'
          : currentLang === 'kn'
          ? 'ಮುಖಪುಟಕ್ಕೆ ಹೋಗಲಾಗುತ್ತಿದೆ.'
          : 'Taking you to the home screen.';
      return { type: 'navigate', screen: 'home', feedback };
    }

    // 11. Screen summary / Overview
    if (
      text.includes('what is on') ||
      text.includes("what's on") ||
      text.includes('summarize') ||
      text.includes('describe') ||
      text.includes('क्या है') ||
      text.includes('स्क्रीन') ||
      text.includes('ಏನಿದೆ') ||
      text.includes('ವಿವರಣೆ')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'आप स्वास्थ्य सेतु में हैं। आप दवाइयाँ, हार्ट रेट, या डॉक्टर से बातचीत देख सकते हैं।'
          : currentLang === 'kn'
          ? 'ನೀವು ಸ್ವಾಸ್ಥ್ಯಸೇತು ಅಪ್ಲಿಕೇಶನ್‌ನಲ್ಲಿದ್ದೀರಿ. ನೀವು ಔಷಧಿಗಳು, ಹೃದಯ ಬಡಿತ, ಅಥವಾ ವೈದ್ಯರ ಸಂದೇಶಗಳನ್ನು ಪರಿಶೀಲಿಸಬಹುದು.'
          : 'You are on SwasthyaSetu. You can check your medicines, measure heart rate, or message your doctor.';
      return { type: 'screen_summary', feedback };
    }

    // 12. Help
    if (
      text.includes('help') ||
      text.includes('what can you do') ||
      text.includes('options') ||
      text.includes('मदद') ||
      text.includes('क्या कर सकते हो') ||
      text.includes('ಸಹಾಯ') ||
      text.includes('ಏನು ಮಾಡಬಹುದು')
    ) {
      const feedback =
        currentLang === 'hi'
          ? 'आप कह सकते हैं: "दवाइयाँ दिखाओ", "हार्ट रेट", "डॉक्टर को मैसेज", या "इमरजेंसी"।'
          : currentLang === 'kn'
          ? 'ನೀವು ಹೀಗೆ ಹೇಳಬಹುದು: "ಔಷಧಿಗಳು ತೋರಿಸಿ", "ಹೃದಯ ಬಡಿತ", "ವೈದ್ಯರಿಗೆ ಸಂದೇಶ", ಅಥವಾ "ತುರ್ತು".'
          : 'You can say: "Show medicines", "Heart rate", "Message doctor", or "Emergency".';
      return { type: 'help', feedback };
    }

    // Unknown command fallback
    const unknownFeedback =
      currentLang === 'hi'
        ? `"${rawText}" समझ नहीं आया। आप "दवाइयाँ", "हार्ट रेट", या "मदद" कह सकते हैं।`
        : currentLang === 'kn'
        ? `"${rawText}" ಅರ್ಥವಾಗಲಿಲ್ಲ. ನೀವು "ಔಷಧಿಗಳು", "ಹೃದಯ ಬಡಿತ", ಅಥವಾ "ಸಹಾಯ" ಎಂದು ಹೇಳಬಹುದು.`
        : `I didn't quite get "${rawText}". Try saying "Medicines", "Heart rate", or "Help".`;

    return { type: 'unknown', rawText, feedback: unknownFeedback };
  }

  public processCommand(commandText: string) {
    const action = this.parseIntent(commandText, this.state.language);

    // Speak verbal feedback
    this.speakReply(action.feedback, this.state.language);

    // Dispatch to registered action handlers
    for (const handler of this.actionHandlers) {
      handler(action, commandText);
    }
  }

  public onAction(handler: ActionHandler): () => void {
    this.actionHandlers.add(handler);
    return () => this.actionHandlers.delete(handler);
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  public getState(): ChibiVoiceState {
    return { ...this.state };
  }

  private updateState(patch: Partial<ChibiVoiceState>) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify() {
    const copy = { ...this.state };
    for (const l of this.listeners) {
      l(copy);
    }
  }
}

export const chibiVoice = new ChibiVoiceService();
