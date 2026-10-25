import type { ComponentType } from 'react';
import type { IconProps as PhosphorProps } from '@phosphor-icons/react';
// Per-icon ESM imports (package export "./dist/csr/*"): only these glyphs are bundled, and Vite dev
// never pre-bundles the 1,500-icon barrel. Add new icons here; never import Phosphor in a screen.
import { FloppyDisk } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { ChatsCircle } from '@phosphor-icons/react/dist/csr/ChatsCircle';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { Keyboard } from '@phosphor-icons/react/dist/csr/Keyboard';
import { FileCode } from '@phosphor-icons/react/dist/csr/FileCode';
import { ArrowsOutSimple } from '@phosphor-icons/react/dist/csr/ArrowsOutSimple';
import { ArrowsInSimple } from '@phosphor-icons/react/dist/csr/ArrowsInSimple';
import { StopCircle } from '@phosphor-icons/react/dist/csr/StopCircle';
import { WifiHigh } from '@phosphor-icons/react/dist/csr/WifiHigh';
import { PhoneIncoming } from '@phosphor-icons/react/dist/csr/PhoneIncoming';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { BellRinging } from '@phosphor-icons/react/dist/csr/BellRinging';
import { Buildings } from '@phosphor-icons/react/dist/csr/Buildings';
import { CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { CalendarDots } from '@phosphor-icons/react/dist/csr/CalendarDots';
import { CameraRotate } from '@phosphor-icons/react/dist/csr/CameraRotate';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { ClipboardText } from '@phosphor-icons/react/dist/csr/ClipboardText';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { CloudArrowUp } from '@phosphor-icons/react/dist/csr/CloudArrowUp';
import { CloudSlash } from '@phosphor-icons/react/dist/csr/CloudSlash';
import { DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobile';
import { Ear } from '@phosphor-icons/react/dist/csr/Ear';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { FirstAidKit } from '@phosphor-icons/react/dist/csr/FirstAidKit';
import { FolderOpen } from '@phosphor-icons/react/dist/csr/FolderOpen';
import { HandHeart } from '@phosphor-icons/react/dist/csr/HandHeart';
import { Heartbeat } from '@phosphor-icons/react/dist/csr/Heartbeat';
import { HourglassHigh } from '@phosphor-icons/react/dist/csr/HourglassHigh';
import { IdentificationCard } from '@phosphor-icons/react/dist/csr/IdentificationCard';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { Key } from '@phosphor-icons/react/dist/csr/Key';
import { Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Microphone } from '@phosphor-icons/react/dist/csr/Microphone';
import { MicrophoneSlash } from '@phosphor-icons/react/dist/csr/MicrophoneSlash';
import { Notepad } from '@phosphor-icons/react/dist/csr/Notepad';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import { Phone } from '@phosphor-icons/react/dist/csr/Phone';
import { PhoneSlash } from '@phosphor-icons/react/dist/csr/PhoneSlash';
import { PhoneX } from '@phosphor-icons/react/dist/csr/PhoneX';
import { Pill } from '@phosphor-icons/react/dist/csr/Pill';
import { Scan } from '@phosphor-icons/react/dist/csr/Scan';
import { Scroll } from '@phosphor-icons/react/dist/csr/Scroll';
import { SealCheck } from '@phosphor-icons/react/dist/csr/SealCheck';
import { Shield } from '@phosphor-icons/react/dist/csr/Shield';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { ShieldPlus } from '@phosphor-icons/react/dist/csr/ShieldPlus';
import { ShieldWarning } from '@phosphor-icons/react/dist/csr/ShieldWarning';
import { SignIn } from '@phosphor-icons/react/dist/csr/SignIn';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { Signature } from '@phosphor-icons/react/dist/csr/Signature';
import { Siren } from '@phosphor-icons/react/dist/csr/Siren';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { Stethoscope } from '@phosphor-icons/react/dist/csr/Stethoscope';
import { Translate } from '@phosphor-icons/react/dist/csr/Translate';
import { Tray } from '@phosphor-icons/react/dist/csr/Tray';
import { User } from '@phosphor-icons/react/dist/csr/User';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { VideoCameraSlash } from '@phosphor-icons/react/dist/csr/VideoCameraSlash';
import { Virus } from '@phosphor-icons/react/dist/csr/Virus';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { X } from '@phosphor-icons/react/dist/csr/X';

/**
 * App-level semantic icon names → Phosphor glyphs. Names match the Patient registry where the
 * meaning is shared (brand, lock, key, verified, call, callEnd, video, mic, listen, emergency…).
 */
export const REGISTRY = {
  // Brand & navigation
  brand: HandHeart,
  back: ArrowLeft,
  chevronLeft: CaretLeft,
  chevronRight: CaretRight,
  chevronDown: CaretDown,
  close: X,
  search: MagnifyingGlass,
  translate: Translate,
  signIn: SignIn,
  signOut: SignOut,
  notification: BellRinging,
  swap: ArrowsLeftRight,
  sync: ArrowsClockwise,
  send: PaperPlaneTilt,

  // Trust & consent
  shield: Shield,
  shieldCheck: ShieldCheck,
  verified: SealCheck,
  lock: Lock,
  unlock: LockOpen,
  key: Key,
  idCard: IdentificationCard,
  view: Eye,
  sign: Signature,
  insurance: ShieldPlus,
  drugAlert: ShieldWarning,

  // Status
  check: Check,
  checkCircle: CheckCircle,
  info: Info,
  warning: Warning,
  error: WarningCircle,
  emergency: Siren,
  offline: CloudSlash,
  storeForward: CloudArrowUp,
  inbox: Tray,
  bolt: Lightning,
  aiAssist: Sparkle,

  // Time
  calendar: CalendarBlank,
  upcoming: CalendarCheck,
  reschedule: CalendarDots,
  clock: Clock,
  hourglass: HourglassHigh,

  // Call & audio
  call: Phone,
  callEnd: PhoneX,
  callDeclined: PhoneSlash,
  video: VideoCamera,
  videoOff: VideoCameraSlash,
  cameraSwitch: CameraRotate,
  mic: Microphone,
  micOff: MicrophoneSlash,
  listen: SpeakerHigh,
  speakerOff: SpeakerSlash,
  hearing: Ear,
  mobile: DeviceMobile,

  // People & places
  person: User,
  people: Users,
  doctor: Stethoscope,
  building: Buildings,

  // Records & care
  chart: ClipboardText,
  clinicalNotes: Notepad,
  history: Scroll,
  medicalId: FirstAidKit,
  records: FolderOpen,
  imaging: Scan,
  medication: Pill,
  vitals: Heartbeat,
  symptom: Virus,
  // Notepad & consultation call
  save: FloppyDisk,
  undo: ArrowCounterClockwise,
  add: Plus,
  chat: ChatsCircle,
  checklist: ListChecks,
  keyboard: Keyboard,
  code: FileCode,
  expand: ArrowsOutSimple,
  collapse: ArrowsInSimple,
  stop: StopCircle,
  online: WifiHigh,
  callIncoming: PhoneIncoming,
} satisfies Record<string, ComponentType<PhosphorProps>>;

export type IconName = keyof typeof REGISTRY;

/** All registered names, for the dev Style Guide. */
export const ICON_NAMES = Object.keys(REGISTRY) as IconName[];
