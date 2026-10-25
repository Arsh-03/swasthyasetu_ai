import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/*
 * Soft, flat, organic illustrations (docs/05_ui_ux/motion_and_illustration.md).
 * Rules: palette tokens only, no raster, no gradients-as-3D, no clay/3D shading,
 * one blob background + one simple subject, generous negative space.
 * All are decorative: hidden from screen readers (the screen text carries the meaning).
 */

interface IllustrationProps {
  /** Rendered width; height follows the 5:4 artboard. */
  width?: number;
}

const BLOBS = [
  'M100 12c34 0 70 18 76 52s-14 66-46 78-72 8-96-12S6 82 18 54 66 12 100 12z',
  'M96 14c30-4 64 10 78 38s6 64-20 82-70 20-96 4S14 96 18 64 66 18 96 14z',
  'M104 16c28 2 58 20 68 48s-2 60-30 74-66 14-90-4-30-50-18-76 42-44 70-42z',
] as const;

const Artboard: React.FC<{ width: number; children: React.ReactNode }> = ({ width, children }) => (
  // Accessibility props live on the View: react-native-svg forwards Svg props to the DOM on web.
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={width} height={(width * 4) / 5} viewBox="0 0 200 160">
      {children}
    </Svg>
  </View>
);

/** Organic background blob. `variant` picks one of three shapes. */
export const Blob: React.FC<IllustrationProps & { color?: string; variant?: 0 | 1 | 2; opacity?: number }> = ({
  width = 200,
  color = colors.ice,
  variant = 0,
  opacity = 1,
}) => (
  <Artboard width={width}>
    <Path d={BLOBS[variant]} fill={color} fillOpacity={opacity} />
  </Artboard>
);

/** Login / onboarding hero: shield with a check, held by two leaves, on an ice blob. */
export const LoginHero: React.FC<IllustrationProps> = ({ width = 220 }) => (
  <Artboard width={width}>
    <Path d={BLOBS[0]} fill={colors.ice} />
    <Circle cx={160} cy={36} r={10} fill={colors.sand} />
    <Circle cx={36} cy={118} r={6} fill={colors.fog} />
    {/* Leaves */}
    <Path d="M58 120c-6-26 6-46 30-52-2 24-12 42-30 52z" fill={colors.success} fillOpacity={0.55} />
    <Path d="M142 120c6-26-6-46-30-52 2 24 12 42 30 52z" fill={colors.success} fillOpacity={0.4} />
    {/* Shield */}
    <Path d="M100 34l34 12v26c0 24-14 40-34 50-20-10-34-26-34-50V46z" fill={colors.primary} />
    <Path d="M100 42l26 9v21c0 19-11 32-26 40z" fill={colors.ink} fillOpacity={0.18} />
    <Path d="M86 76l10 10 20-22" stroke={colors.card} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Artboard>
);

/** Empty records: an open folder with a small lock. */
export const EmptyRecords: React.FC<IllustrationProps> = ({ width = 180 }) => (
  <Artboard width={width}>
    <Path d={BLOBS[1]} fill={colors.ice} />
    <Rect x={52} y={50} width={96} height={68} rx={10} fill={colors.primarySoft} />
    <Path d="M52 62c0-6 4-10 10-10h22l8 8h46c6 0 10 4 10 10v40c0 6-4 10-10 10H62c-6 0-10-4-10-10z" fill={colors.primary} />
    <Rect x={66} y={42} width={60} height={30} rx={6} fill={colors.card} />
    <Rect x={74} y={50} width={36} height={4} rx={2} fill={colors.fog} />
    <Rect x={74} y={58} width={24} height={4} rx={2} fill={colors.fog} />
    <G>
      <Rect x={124} y={96} width={26} height={22} rx={6} fill={colors.gold} />
      <Path d="M130 96v-6a7 7 0 0114 0v6" stroke={colors.gold} strokeWidth={4} fill="none" strokeLinecap="round" />
    </G>
  </Artboard>
);

/** Empty medications: a capsule and a round tablet. */
export const EmptyMedications: React.FC<IllustrationProps> = ({ width = 180 }) => (
  <Artboard width={width}>
    <Path d={BLOBS[2]} fill={colors.ice} />
    <G transform="rotate(-35 96 82)">
      <Rect x={56} y={66} width={80} height={32} rx={16} fill={colors.card} />
      <Path d="M96 66h24a16 16 0 010 32H96z" fill={colors.primary} />
    </G>
    <Circle cx={138} cy={110} r={16} fill={colors.sand} />
    <Rect x={128} y={108} width={20} height={4} rx={2} fill={colors.fog} />
    <Circle cx={60} cy={46} r={5} fill={colors.success} fillOpacity={0.5} />
  </Artboard>
);

/** Empty appointments: a calendar page with one soft dot. */
export const EmptyAppointments: React.FC<IllustrationProps> = ({ width = 180 }) => (
  <Artboard width={width}>
    <Path d={BLOBS[0]} fill={colors.ice} />
    <Rect x={58} y={44} width={84} height={78} rx={12} fill={colors.card} />
    <Path d="M58 56c0-7 5-12 12-12h60c7 0 12 5 12 12v8H58z" fill={colors.primary} />
    <Rect x={76} y={36} width={6} height={16} rx={3} fill={colors.ink} />
    <Rect x={118} y={36} width={6} height={16} rx={3} fill={colors.ink} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <Rect key={`${r}-${c}`} x={70 + c * 16} y={74 + r * 14} width={10} height={8} rx={3} fill={colors.fog} />
      ))
    )}
    <Circle cx={118} cy={92} r={7} fill={colors.warning} fillOpacity={0.7} />
  </Artboard>
);

/** Empty access log: a ledger page with a small shield and check. */
export const EmptyAccessLog: React.FC<IllustrationProps> = ({ width = 180 }) => (
  <Artboard width={width}>
    <Path d={BLOBS[2]} fill={colors.ice} />
    <Rect x={56} y={38} width={80} height={90} rx={10} fill={colors.card} />
    <Rect x={70} y={30} width={52} height={16} rx={6} fill={colors.primary} />
    {[0, 1, 2].map((i) => (
      <G key={i}>
        <Circle cx={74} cy={64 + i * 18} r={5} fill={colors.primarySoft} />
        <Rect x={84} y={61 + i * 18} width={i === 1 ? 26 : 38} height={6} rx={3} fill={colors.fog} />
      </G>
    ))}
    <Path d="M140 86l20 7v15c0 14-8 23-20 29-12-6-20-15-20-29V93z" fill={colors.success} />
    <Path d="M132 110l6 6 12-13" stroke={colors.card} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx={44} cy={52} r={6} fill={colors.sand} />
  </Artboard>
);

/** Call waiting: a person in soft concentric rings (dark call screen). */
export const CallWaiting: React.FC<IllustrationProps> = ({ width = 200 }) => (
  <Artboard width={width}>
    <Circle cx={100} cy={80} r={68} fill={colors.ice} fillOpacity={0.08} />
    <Circle cx={100} cy={80} r={50} fill={colors.ice} fillOpacity={0.12} />
    <Circle cx={100} cy={80} r={34} fill={colors.primary} />
    <Circle cx={100} cy={72} r={10} fill={colors.ice} />
    <Path d="M80 98c2-11 10-16 20-16s18 5 20 16z" fill={colors.ice} />
    <Circle cx={150} cy={44} r={8} fill={colors.success} />
  </Artboard>
);

export const ILLUSTRATIONS = [
  { name: 'Blob', Component: Blob },
  { name: 'LoginHero', Component: LoginHero },
  { name: 'EmptyRecords', Component: EmptyRecords },
  { name: 'EmptyMedications', Component: EmptyMedications },
  { name: 'EmptyAppointments', Component: EmptyAppointments },
  { name: 'EmptyAccessLog', Component: EmptyAccessLog },
  { name: 'CallWaiting', Component: CallWaiting },
] as const;
