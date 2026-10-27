// CHIBI (Central Health Informatics Bot Interface) in the patient app: a small friendly assistant in the corner.
// Tap it for what it can do right now (heart rate, medicines, joining a consultation, messages, who has seen
// your records). Any feature can add a skill with registerChibiSkill (e.g. the accessibility / navigation work).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { colors, radii, spacing, tints } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText, Icon, type IconName } from '../ui';
import { Speakable, useScripts } from '../../speech';

export type ChibiMood = 'idle' | 'listening' | 'hint' | 'alert';

const PALETTE: Record<ChibiMood, { body: string; glow: string }> = {
  idle: { body: '#1f6f78', glow: '#5eead4' },
  listening: { body: '#1f6f78', glow: '#5eead4' },
  hint: { body: '#5b3fb8', glow: '#c4b5fd' },
  alert: { body: '#b42318', glow: '#fecaca' },
};

export const ChibiFace: React.FC<{ mood?: ChibiMood; size?: number }> = ({ mood = 'idle', size = 56 }) => {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const id = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 140); }, 4200);
    return () => clearInterval(id);
  }, []);
  const p = PALETTE[mood];
  const eyeRy = blink ? 0.6 : 4.2;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Line x1={32} y1={9} x2={32} y2={15} stroke={p.body} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={32} cy={7.5} r={3.6} fill={p.glow} />
      <Rect x={10} y={14} width={44} height={38} rx={17} fill={p.body} />
      <Rect x={15} y={20} width={34} height={25} rx={12} fill="#0f2b33" />
      <Rect x={5} y={27} width={6} height={12} rx={3} fill={p.body} opacity={0.85} />
      <Rect x={53} y={27} width={6} height={12} rx={3} fill={p.body} opacity={0.85} />
      <G>
        <Ellipse cx={25} cy={31} rx={3.4} ry={eyeRy} fill={p.glow} />
        <Ellipse cx={39} cy={31} rx={3.4} ry={eyeRy} fill={p.glow} />
      </G>
      <Path d={mood === 'alert' ? 'M27 40.5 Q32 37.5 37 40.5' : 'M27 38.5 Q32 42 37 38.5'} stroke={p.glow} strokeWidth={2.2}
        strokeLinecap="round" fill="none" />
      <Circle cx={19.5} cy={38} r={2.2} fill="#fda4af" opacity={0.55} />
      <Circle cx={44.5} cy={38} r={2.2} fill="#fda4af" opacity={0.55} />
      <Rect x={22} y={52} width={20} height={9} rx={4.5} fill={p.body} />
    </Svg>
  );
};

// ------------------------------------------------------------------------------------------------- skills
export interface ChibiSkill {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
}
const extraSkills: ChibiSkill[] = [];
const listeners = new Set<() => void>();

/** Add a CHIBI skill from any feature (returns a function that removes it). */
export function registerChibiSkill(skill: ChibiSkill): () => void {
  extraSkills.push(skill);
  listeners.forEach((l) => l());
  return () => {
    const i = extraSkills.indexOf(skill);
    if (i >= 0) extraSkills.splice(i, 1);
    listeners.forEach((l) => l());
  };
}

export const ChibiButton: React.FC<{
  bottom: number;
  skills: ChibiSkill[];
  mood?: ChibiMood;
  badge?: number;
  status?: string;
}> = ({ bottom, skills, mood = 'idle', badge, status }) => {
  const { t } = useLanguage();
  const scripts = useScripts();
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => { const l = () => bump((n) => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -3, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const all = [...skills, ...extraSkills];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      {open && (
        <View style={styles.panel} accessibilityRole="menu">
          <AppText variant="headline" speech={status ? undefined : scripts.chibi.menuTitle}>{status || t('chibiHi')}</AppText>
          <AppText variant="caption" color="inkMuted" style={styles.sub}>Central Health Informatics Bot Interface</AppText>
          {all.map((s) => (
            <Speakable key={s.id} atomic speech={() => scripts.chibi.menuItem(s.label)} accessibilityRole="menuitem" style={({ pressed }) => [styles.skill, pressed && styles.pressed]}
              onPress={() => { setOpen(false); s.run(); }}>
              <Icon name={s.icon} size={20} color={colors.primary} />
              <AppText variant="body" style={styles.skillText}>{s.label}</AppText>
            </Speakable>
          ))}
        </View>
      )}
      <Speakable atomic speech={scripts.chibi.button} onPress={() => setOpen((o) => !o)} accessibilityRole="button"
        accessibilityLabel={`CHIBI${status ? `: ${status}` : ''}`} style={styles.fab}>
        <Animated.View style={{ transform: [{ translateY: bob }] }}>
          <ChibiFace mood={mood} size={50} />
        </Animated.View>
        {badge ? (
          <View style={[styles.badge, mood === 'hint' && styles.badgeHint]}>
            <AppText variant="caption" weight={700} style={styles.badgeText}>{badge > 9 ? '9+' : String(badge)}</AppText>
          </View>
        ) : null}
      </Speakable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: spacing.lg, alignItems: 'flex-end', zIndex: 50 },
  fab: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  panel: {
    width: 290, marginBottom: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.card,
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10, gap: 2,
  },
  sub: { marginBottom: spacing.sm },
  skill: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, paddingHorizontal: spacing.sm, borderRadius: 12, minHeight: 48 },
  pressed: { backgroundColor: tints.primary },
  skillText: { flex: 1 },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#b42318', alignItems: 'center', justifyContent: 'center' },
  badgeHint: { backgroundColor: '#5b3fb8' },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14 },
});
