import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, elevation, radii, spacing } from '../../theme/tokens';
import { timing } from '../../theme/motion';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps<V extends string> {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const PADDING = 4;
const THUMB_RADIUS = radii.sm;

/**
 * Segmented control: tonal track, white selected thumb with a subtle border (#DCE5EA) and e1 elevation.
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  style,
  accessibilityLabel,
}: SegmentedControlProps<V>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - PADDING * 2) / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(index * segment, timing.transition) }],
  }));

  return (
    <View
      style={style}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.track}>
        {segment > 0 && (
          <Animated.View
            style={[styles.thumb, elevation.e1, { width: segment }, thumbStyle]}
            pointerEvents="none"
          />
        )}
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (!selected) {
                  haptic.selection();
                  onChange(opt.value);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
              style={styles.item}
            >
              {opt.icon && (
                <Icon
                  name={opt.icon}
                  size={18}
                  color={selected ? colors.primary : colors.inkMuted}
                  active={selected}
                />
              )}
              <AppText
                variant="subhead"
                weight={selected ? 700 : 500}
                color={selected ? 'ink' : 'inkMuted'}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                align="center"
                compact
                style={styles.label}
              >
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PADDING,
    backgroundColor: '#E5ECF0',
    borderRadius: radii.md,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    backgroundColor: colors.card,
    borderRadius: THUMB_RADIUS,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  item: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    zIndex: 1,
  },
  label: {
    flexShrink: 1,
  },
});
