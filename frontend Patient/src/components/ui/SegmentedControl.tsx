import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, radii } from '../../theme/tokens';
import { timing } from '../../theme/motion';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { depth, NeuInset, RaisedLayer } from './Neu';

export interface SegmentOption<V extends string> {
  value: V;
  /** Keep it short (use the seg* translation keys); it wraps to two lines rather than truncating. */
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

const PADDING = 5;
const THUMB_RADIUS = radii.sm;

/**
 * Inset track + raised highlight thumb (STRONG, the only element allowed inside an inset)
 * + bold ink label. Segments have equal widths; labels never truncate: they shrink slightly,
 * then wrap to two lines (en / kn / hi at large font scale).
 */
export function SegmentedControl<V extends string>({ options, value, onChange, style, accessibilityLabel }: SegmentedControlProps<V>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - PADDING * 2) / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(index * segment, timing.transition) }],
  }));

  return (
    <View style={style} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      <NeuInset radius={radii.md + 2} style={styles.track}>
        {segment > 0 && (
          <Animated.View style={[styles.thumb, depth.layer, { width: segment }, thumbStyle]} pointerEvents="none">
            <RaisedLayer radius={THUMB_RADIUS} compact />
          </Animated.View>
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
              {opt.icon && <Icon name={opt.icon} size={18} color={selected ? colors.primary : colors.inkMuted} active={selected} />}
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
      </NeuInset>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PADDING,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
  },
  item: {
    flex: 1,
    flexBasis: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  label: {
    flexShrink: 1,
  },
});
