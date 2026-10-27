import React, { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, spacing, touch } from '../../theme/tokens';
import type { SupportedLanguage } from '../../utils/translations';
import { AppText, Icon, NeuPressable, PopBurstEffect } from '../ui';
import { useScripts } from '../../speech';

export interface DoseButtonProps {
  taken: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  lang?: SupportedLanguage;
  /** Medicine name for the spoken script. */
  speechName?: string;
}

/** Raised "Take" control with celebratory spring pop burst and audio feedback. */
export const DoseButton: React.FC<DoseButtonProps> = ({
  taken,
  label,
  accessibilityLabel,
  onPress,
  lang,
  speechName,
}) => {
  const scripts = useScripts();
  const [showBurst, setShowBurst] = useState(false);
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePress = () => {
    if (!taken) {
      setShowBurst(true);
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.25, friction: 3, tension: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    onPress();
  };

  return (
    <View style={styles.doseBtnContainer}>
      <PopBurstEffect active={showBurst} onComplete={() => setShowBurst(false)} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <NeuPressable
          onPress={handlePress}
          atomic
          speech={speechName ? () => (taken ? scripts.medication.taken(speechName) : scripts.medication.markTaken(speechName)) : undefined}
          selected={taken}
          haptics="none"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: taken }}
          accessibilityLabel={accessibilityLabel}
          containerStyle={styles.doseBtnWrap}
          style={styles.doseBtn}
        >
          {taken && <Icon name="check" size={18} color={colors.successDeep} />}
          <AppText variant="footnote" weight={700} color={taken ? 'ink' : 'primary'} lang={lang} compact>
            {label}
          </AppText>
        </NeuPressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  doseBtnContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  doseBtnWrap: {
    alignSelf: 'center',
  },
  doseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: touch.min,
    minWidth: 84,
    paddingHorizontal: spacing.md,
  },
});
