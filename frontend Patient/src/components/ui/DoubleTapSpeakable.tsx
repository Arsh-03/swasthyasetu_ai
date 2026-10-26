import React, { useRef, useId, useState, useEffect } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
  type PressableStateCallbackType,
} from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';
import { useSpeech } from '../../i18n/SpeechContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Icon } from './Icon';
import { AppText } from './AppText';

export interface DoubleTapSpeakableProps {
  /** Text to read aloud on double tap; can be a function evaluated at tap time. */
  text?: string | (() => string);
  /** Alias for `text` */
  speechText?: string | (() => string);
  /** Optional custom identifier for speech state tracking. */
  speechId?: string;
  /** Pass-through single tap action. Executes immediately with zero lag. */
  onPress?: () => void;
  children: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode);
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Whether to show glowing highlight border and audio indicator during playback. Default true. */
  showVisualIndicator?: boolean;
  /** Custom border radius matching parent container */
  radius?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** Recursively extracts plain text from child nodes if `text` prop is not explicitly passed. */
const extractText = (node: any): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join(' ');
  if (node.props?.children) return extractText(node.props.children);
  return '';
};

export const DoubleTapSpeakable: React.FC<DoubleTapSpeakableProps> = ({
  text,
  speechText,
  speechId,
  onPress,
  children,
  style,
  containerStyle,
  disabled = false,
  showVisualIndicator = true,
  radius = radii.md,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const generatedId = useId();
  const id = speechId || generatedId;
  const { speakingId, speakElement, stopSpeech } = useSpeech();
  const { t } = useLanguage();
  const isSpeakingThis = speakingId === id;

  const lastTapRef = useRef<number>(0);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isSpeakingThis) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0.4);
    }
  }, [isSpeakingThis, pulseAnim]);

  const getTextToSpeak = (): string => {
    const candidate = speechText !== undefined ? speechText : text;
    if (typeof candidate === 'function') return candidate();
    if (typeof candidate === 'string') return candidate;
    return typeof children !== 'function' ? extractText(children) : '';
  };

  const handlePress = () => {
    if (disabled) return;

    const now = Date.now();
    const timeSinceLast = now - lastTapRef.current;
    lastTapRef.current = now;

    if (timeSinceLast > 0 && timeSinceLast < 380) {
      // Double tap detected: Speak element!
      const content = getTextToSpeak();
      if (content) {
        speakElement(id, content);
      }
    } else {
      // First single tap:
      if (isSpeakingThis) {
        // Tapping an active speaking element stops it
        stopSpeech();
      } else {
        // Immediate normal action with zero lag
        onPress?.();
      }
    }
  };

  // Support desktop double-click seamlessly for development & browser testing
  const handleDoubleClick = () => {
    if (disabled) return;
    const content = getTextToSpeak();
    if (content) {
      speakElement(id, content);
    }
  };

  const resolveStyle = (state: PressableStateCallbackType) => {
    const computedStyle = typeof style === 'function' ? style(state) : style;
    return [
      styles.wrapper,
      containerStyle,
      computedStyle,
      isSpeakingThis && showVisualIndicator && [styles.speakingActive, { borderRadius: radius }],
    ];
  };

  return (
    <Pressable
      onPress={handlePress}
      // @ts-ignore - React Native Web supports onDoubleClick
      onDoubleClick={handleDoubleClick}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint || t('doubleTapToHear')}
      style={resolveStyle}
    >
      {(state) => (
        <>
          {typeof children === 'function' ? children(state) : children}

          {/* Glowing pulsing audio indicator badge (Answer 3 from user) */}
          {isSpeakingThis && showVisualIndicator && (
            <Animated.View
              style={[
                styles.speakingBadge,
                {
                  opacity: pulseAnim,
                  transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.92, 1.05] }) }],
                },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icon name="listen" size={13} color={colors.onPrimary} active />
              <AppText variant="caption" weight={700} color="onPrimary">
                {t('speaking')}
              </AppText>
            </Animated.View>
          )}
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  speakingActive: {
    borderWidth: 2.5,
    borderColor: colors.teal,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
    backgroundColor: '#F3FAFB',
  },
  speakingBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.tealDeep,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});
