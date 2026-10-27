// CHIBI (Central Health Informatics Bot Interface) in the patient app:
// Friendly animated assistant with integrated multilingual Voice Navigation & Spoken Responses.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { colors, radii, spacing, tints } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppText, Icon, type IconName } from '../ui';
import { Speakable, useScripts } from '../../speech';
import {
  chibiVoice,
  type ChibiAction,
  type ChibiVoiceState,
} from '../../services/voice/chibiVoiceService';

export type ChibiMood = 'idle' | 'listening' | 'hint' | 'alert';

const PALETTE: Record<ChibiMood, { body: string; glow: string }> = {
  idle: { body: '#1f6f78', glow: '#5eead4' },
  listening: { body: '#0d9488', glow: '#2dd4bf' },
  hint: { body: '#5b3fb8', glow: '#c4b5fd' },
  alert: { body: '#b42318', glow: '#fecaca' },
};

export const ChibiFace: React.FC<{ mood?: ChibiMood; size?: number }> = ({ mood = 'idle', size = 56 }) => {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 4200);
    return () => clearInterval(id);
  }, []);
  const p = PALETTE[mood] || PALETTE.idle;
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
      <Path
        d={mood === 'alert' ? 'M27 40.5 Q32 37.5 37 40.5' : 'M27 38.5 Q32 42 37 38.5'}
        stroke={p.glow}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
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
  onVoiceAction?: (action: ChibiAction) => void;
}> = ({ bottom, skills, mood = 'idle', badge, status, onVoiceAction }) => {
  const { lang, t } = useLanguage();
  const scripts = useScripts();
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const [typedInput, setTypedInput] = useState('');
  const [voiceState, setVoiceState] = useState<ChibiVoiceState>(() => chibiVoice.getState());

  // Subscribe to extra skills
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // Sync assistant language with language context
  useEffect(() => {
    chibiVoice.setLanguage(lang);
  }, [lang]);

  // Subscribe to voice state updates
  useEffect(() => {
    return chibiVoice.subscribe((s) => {
      setVoiceState(s);
    });
  }, []);

  // Listen for voice action dispatches
  useEffect(() => {
    if (!onVoiceAction) return;
    return chibiVoice.onAction((action) => {
      onVoiceAction(action);
    });
  }, [onVoiceAction]);

  // Floating bob animation
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -3, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  // Listening pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (voiceState.status === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [voiceState.status, pulseAnim]);

  // Effective mood for CHIBI face
  const effectiveMood: ChibiMood =
    voiceState.status === 'listening'
      ? 'listening'
      : voiceState.status === 'speaking' || voiceState.status === 'processing'
      ? 'hint'
      : mood;

  const allSkills = [...skills, ...extraSkills];

  const handleMicToggle = () => {
    chibiVoice.toggleListening();
  };

  const handleTextSubmit = () => {
    if (!typedInput.trim()) return;
    const cmd = typedInput.trim();
    setTypedInput('');
    chibiVoice.processCommand(cmd);
  };

  const quickVoicePills = [
    { label: t('tabMedications'), command: 'Show medicines', icon: 'medication' as IconName },
    { label: t('chibiHeart'), command: 'Check heart rate', icon: 'heartbeat' as IconName },
    { label: t('tabChat'), command: 'Message doctor', icon: 'chat' as IconName },
    { label: t('chibiVoiceDoctors'), command: 'My doctors', icon: 'person' as IconName },
    { label: t('chibiVoiceRecords'), command: 'Medical records', icon: 'records' as IconName },
    { label: t('chibiVoiceSOS'), command: 'Emergency', icon: 'emergency' as IconName },
  ];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      {open && (
        <View style={styles.panel} accessibilityRole="dialog" aria-label="CHIBI Voice Assistant">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ChibiFace mood={effectiveMood} size={36} />
              <View style={styles.headerTitles}>
                <AppText variant="headline" style={styles.titleText}>
                  {t('chibiVoiceAssistant')}
                </AppText>
                <AppText variant="caption" color="inkMuted">
                  {voiceState.status === 'listening'
                    ? t('chibiListening')
                    : voiceState.status === 'speaking'
                    ? 'Speaking...'
                    : t('chibiHi')}
                </AppText>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel={voiceState.isMuted ? t('chibiVoiceUnmute') : t('chibiVoiceMute')}
                onPress={() => chibiVoice.setMuted(!voiceState.isMuted)}
                style={styles.headerBtn}
              >
                <Icon
                  name={voiceState.isMuted ? 'micOff' : 'listen'}
                  size={18}
                  color={voiceState.isMuted ? colors.inkMuted : colors.primary}
                />
              </Pressable>

              <Pressable accessibilityLabel="Close CHIBI" onPress={() => setOpen(false)} style={styles.headerBtn}>
                <Icon name="close" size={18} color={colors.inkMuted} />
              </Pressable>
            </View>
          </View>

          {/* Voice Interaction Mic Section */}
          <Pressable
            onPress={handleMicToggle}
            accessibilityRole="button"
            accessibilityLabel={voiceState.status === 'listening' ? t('chibiStopListening') : t('chibiTapToSpeak')}
            style={[styles.voiceBox, voiceState.status === 'listening' && styles.voiceBoxListening]}
          >
            <View style={styles.micRow}>
              <View style={styles.micWrapper}>
                {voiceState.status === 'listening' && (
                  <Animated.View pointerEvents="none" style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
                )}
                <View
                  style={[styles.micBtn, voiceState.status === 'listening' && styles.micBtnActive]}
                >
                  <Icon
                    name="mic"
                    size={24}
                    color={voiceState.status === 'listening' ? '#ffffff' : colors.primary}
                  />
                </View>
              </View>

              <View style={styles.micLabelCol}>
                <AppText variant="subhead" weight={700} color={voiceState.status === 'listening' ? 'primary' : 'ink'}>
                  {voiceState.status === 'listening' ? t('chibiListening') : t('chibiTapToSpeak')}
                </AppText>
                <AppText variant="caption" color="inkMuted" numberOfLines={1}>
                  {t('chibiSaySomething')}
                </AppText>
              </View>
            </View>

            {/* Error Message Alert */}
            {Boolean(voiceState.errorMessage) && (
              <View style={styles.errorBox}>
                <Icon name="warning" size={14} color="#b45309" />
                <AppText variant="caption" style={styles.errorText} numberOfLines={2}>
                  {voiceState.errorMessage}
                </AppText>
              </View>
            )}

            {/* Transcript / Spoken Preview */}
            {(Boolean(voiceState.interimTranscript) || Boolean(voiceState.finalTranscript)) && (
              <View style={styles.transcriptBox}>
                <AppText variant="caption" weight={600} color="primary" style={styles.transcriptTag}>
                  {t('chibiHeard')}:
                </AppText>
                <AppText variant="body" style={styles.transcriptText}>
                  "{voiceState.interimTranscript || voiceState.finalTranscript}"
                </AppText>
              </View>
            )}

            {/* Last Assistant Response */}
            {Boolean(voiceState.lastReply) && (
              <View style={styles.replyBox}>
                <Icon name="sparkle" size={14} color="#7c3aed" />
                <AppText variant="caption" style={styles.replyText} numberOfLines={2}>
                  {voiceState.lastReply}
                </AppText>
              </View>
            )}
          </Pressable>

          {/* Quick Voice Chips */}
          <View style={styles.pillsWrap}>
            {quickVoicePills.map((pill, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
                onPress={() => {
                  chibiVoice.processCommand(pill.command);
                }}
              >
                <Icon name={pill.icon} size={14} color={colors.primary} />
                <AppText variant="caption" weight={600} style={styles.pillText}>
                  {pill.label}
                </AppText>
              </Pressable>
            ))}
          </View>

          {/* Typed Voice Command Fallback */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder={t('chibiTypeCommand')}
              placeholderTextColor={colors.inkMuted}
              value={typedInput}
              onChangeText={setTypedInput}
              onSubmitEditing={handleTextSubmit}
              returnKeyType="send"
            />
            {Boolean(typedInput.trim()) && (
              <Pressable onPress={handleTextSubmit} style={styles.sendBtn}>
                <Icon name="send" size={16} color="#ffffff" />
              </Pressable>
            )}
          </View>

          {/* Quick Skills List */}
          <View style={styles.skillsSection}>
            {allSkills.map((s) => (
              <Speakable
                key={s.id}
                atomic
                speech={() => scripts.chibi.menuItem(s.label)}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.skill, pressed && styles.pressed]}
                onPress={() => {
                  setOpen(false);
                  s.run();
                }}
              >
                <Icon name={s.icon} size={18} color={colors.primary} />
                <AppText variant="body" style={styles.skillText}>
                  {s.label}
                </AppText>
              </Speakable>
            ))}
          </View>
        </View>
      )}

      {/* Floating CHIBI button */}
      <Speakable
        atomic
        speech={scripts.chibi.button}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`CHIBI${status ? `: ${status}` : ''}`}
        style={[styles.fab, voiceState.status === 'listening' && styles.fabListening]}
      >
        <Animated.View style={{ transform: [{ translateY: bob }] }}>
          <ChibiFace mood={effectiveMood} size={50} />
        </Animated.View>
        {badge ? (
          <View style={[styles.badge, mood === 'hint' && styles.badgeHint]}>
            <AppText variant="caption" weight={700} style={styles.badgeText}>
              {badge > 9 ? '9+' : String(badge)}
            </AppText>
          </View>
        ) : null}
      </Speakable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    alignItems: 'flex-end',
    zIndex: 90,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabListening: {
    borderWidth: 2.5,
    borderColor: '#0d9488',
  },
  panel: {
    width: 320,
    maxHeight: 560,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerTitles: {
    flex: 1,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tints.primary,
  },
  voiceBox: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  voiceBoxListening: {
    backgroundColor: '#ecfdf5',
    borderColor: '#5eead4',
  },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  micWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(45, 212, 191, 0.35)',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    shadowColor: '#0f766e',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  micBtnActive: {
    backgroundColor: '#0d9488',
    borderColor: '#14b8a6',
  },
  micLabelCol: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderRadius: radii.sm,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  errorText: {
    fontSize: 11,
    color: '#92400e',
    flex: 1,
  },
  transcriptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderRadius: radii.sm,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptTag: {
    fontSize: 11,
  },
  transcriptText: {
    fontSize: 12,
    color: colors.ink,
    fontStyle: 'italic',
    flex: 1,
  },
  replyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#faf5ff',
    borderRadius: radii.sm,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  replyText: {
    fontSize: 12,
    color: '#6b21a8',
    flex: 1,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tints.primary,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  pillPressed: {
    opacity: 0.75,
  },
  pillText: {
    fontSize: 11,
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillsSection: {
    maxHeight: 180,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 4,
  },
  skill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.xs,
    borderRadius: 8,
  },
  pressed: {
    backgroundColor: tints.primary,
  },
  skillText: {
    flex: 1,
    fontSize: 13,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#b42318',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeHint: {
    backgroundColor: '#5b3fb8',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 14,
  },
});
