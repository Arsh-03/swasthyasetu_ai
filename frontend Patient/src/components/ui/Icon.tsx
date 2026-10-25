import React from 'react';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
// Per-icon imports (package "exports": ./src/icons/*) so only these glyphs are bundled.
import { BoneIcon } from 'phosphor-react-native/src/icons/Bone';
import { ChatCircleTextIcon } from 'phosphor-react-native/src/icons/ChatCircleText';
import { PaperPlaneRightIcon } from 'phosphor-react-native/src/icons/PaperPlaneRight';
import { BrainIcon } from 'phosphor-react-native/src/icons/Brain';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CellSignalHighIcon } from 'phosphor-react-native/src/icons/CellSignalHigh';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ClipboardTextIcon } from 'phosphor-react-native/src/icons/ClipboardText';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { ClockCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ClockCounterClockwise';
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { FlaskIcon } from 'phosphor-react-native/src/icons/Flask';
import { FolderOpenIcon } from 'phosphor-react-native/src/icons/FolderOpen';
import { HandHeartIcon } from 'phosphor-react-native/src/icons/HandHeart';
import { HeartbeatIcon } from 'phosphor-react-native/src/icons/Heartbeat';
import { HourglassIcon } from 'phosphor-react-native/src/icons/Hourglass';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { IdentificationCardIcon } from 'phosphor-react-native/src/icons/IdentificationCard';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { KeyIcon } from 'phosphor-react-native/src/icons/Key';
import { LifebuoyIcon } from 'phosphor-react-native/src/icons/Lifebuoy';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { LockIcon } from 'phosphor-react-native/src/icons/Lock';
import { MicrophoneIcon } from 'phosphor-react-native/src/icons/Microphone';
import { MicrophoneSlashIcon } from 'phosphor-react-native/src/icons/MicrophoneSlash';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { PauseIcon } from 'phosphor-react-native/src/icons/Pause';
import { PhoneIcon } from 'phosphor-react-native/src/icons/Phone';
import { PhoneXIcon } from 'phosphor-react-native/src/icons/PhoneX';
import { PillIcon } from 'phosphor-react-native/src/icons/Pill';
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { ProhibitIcon } from 'phosphor-react-native/src/icons/Prohibit';
import { SealCheckIcon } from 'phosphor-react-native/src/icons/SealCheck';
import { ShieldIcon } from 'phosphor-react-native/src/icons/Shield';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SignInIcon } from 'phosphor-react-native/src/icons/SignIn';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { SirenIcon } from 'phosphor-react-native/src/icons/Siren';
import { SmileyIcon } from 'phosphor-react-native/src/icons/Smiley';
import { SmileyMehIcon } from 'phosphor-react-native/src/icons/SmileyMeh';
import { SmileyNervousIcon } from 'phosphor-react-native/src/icons/SmileyNervous';
import { SmileySadIcon } from 'phosphor-react-native/src/icons/SmileySad';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { StethoscopeIcon } from 'phosphor-react-native/src/icons/Stethoscope';
import { StopIcon } from 'phosphor-react-native/src/icons/Stop';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { SunHorizonIcon } from 'phosphor-react-native/src/icons/SunHorizon';
import { ThermometerIcon } from 'phosphor-react-native/src/icons/Thermometer';
import { TimerIcon } from 'phosphor-react-native/src/icons/Timer';
import { TranslateIcon } from 'phosphor-react-native/src/icons/Translate';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UsersIcon } from 'phosphor-react-native/src/icons/Users';
import { VideoCameraIcon } from 'phosphor-react-native/src/icons/VideoCamera';
import { VideoCameraSlashIcon } from 'phosphor-react-native/src/icons/VideoCameraSlash';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WindIcon } from 'phosphor-react-native/src/icons/Wind';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { colors } from '../../theme/tokens';
import { checkIconContrast } from '../../utils/devChecks';

/** App-level semantic icon names → Phosphor glyphs. Add new icons here, never import Phosphor in screens. */
const REGISTRY = {
  // Brand & navigation
  brand: HandHeartIcon,
  home: HouseIcon,
  medication: PillIcon,
  records: FolderOpenIcon,
  privacy: ShieldCheckIcon,
  chat: ChatCircleTextIcon,
  send: PaperPlaneRightIcon,
  chevronLeft: CaretLeftIcon,
  chevronRight: CaretRightIcon,
  close: XIcon,
  translate: TranslateIcon,
  signIn: SignInIcon,
  signOut: SignOutIcon,

  // Trust & consent
  shield: ShieldIcon,
  shieldCheck: ShieldCheckIcon,
  verified: SealCheckIcon,
  lock: LockIcon,
  key: KeyIcon,
  idCard: IdentificationCardIcon,
  mobile: DeviceMobileIcon,
  block: ProhibitIcon,

  // Status
  check: CheckIcon,
  checkCircle: CheckCircleIcon,
  info: InfoIcon,
  warning: WarningIcon,
  error: WarningCircleIcon,
  emergency: SirenIcon,
  help: LifebuoyIcon,

  // Time
  calendar: CalendarBlankIcon,
  rescheduled: ClockCounterClockwiseIcon,
  clock: ClockIcon,
  hourglass: HourglassIcon,
  timer: TimerIcon,
  morning: SunIcon,
  afternoon: SunHorizonIcon,
  night: MoonIcon,

  // Call & audio
  call: PhoneIcon,
  callEnd: PhoneXIcon,
  video: VideoCameraIcon,
  videoOff: VideoCameraSlashIcon,
  mic: MicrophoneIcon,
  micOff: MicrophoneSlashIcon,
  network: CellSignalHighIcon,
  listen: SpeakerHighIcon,
  play: PlayIcon,
  pause: PauseIcon,
  stop: StopIcon,
  sparkle: SparkleIcon,
  bolt: LightningIcon,

  // People & places
  person: UserIcon,
  people: UsersIcon,
  doctor: StethoscopeIcon,
  building: BuildingsIcon,

  // Records & care
  clipboard: ClipboardTextIcon,
  document: FileTextIcon,
  lab: FlaskIcon,
  heartbeat: HeartbeatIcon,
  feelingBetter: SmileyIcon,
  feelingSame: SmileyMehIcon,

  // Symptoms
  fever: ThermometerIcon,
  stomach: SmileyNervousIcon,
  cough: WindIcon,
  joint: BoneIcon,
  headache: BrainIcon,
  nausea: SmileySadIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof REGISTRY;

/** All registered names, for the dev icon sheet. */
export const ICON_NAMES = Object.keys(REGISTRY) as IconName[];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Inactive = regular line icon; active / emphasis = duotone with a 20% tint of the same colour. */
  active?: boolean;
  /** The surface the icon sits on (darkest point). In development a warning fires if contrast < 3:1. */
  surface?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, color = colors.ink, active = false, surface }) => {
  checkIconContrast(name, color, surface);
  const Glyph = REGISTRY[name];
  return (
    <Glyph
      size={size}
      color={color}
      weight={active ? 'duotone' : 'regular'}
      duotoneColor={color}
      duotoneOpacity={0.22}
      // An <svg> may flex-shrink on web (RN Views don't); never let a row squeeze an icon to 0px
      style={NO_SHRINK}
    />
  );
};

const NO_SHRINK = { flexShrink: 0 } as const;
