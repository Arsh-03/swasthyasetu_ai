import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, tints } from '../../theme/tokens';
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

/**
 * macOS-style segmented control (`p-1 rounded-xl bg-[#E5E5EA]/70 ring-1 ring-black/5`,
 * selected item `bg-white shadow-apple-sm`). The white thumb slides between items,
 * echoing `.apple-segmented-item`'s 0.2s ease-out transition.
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
  const [x] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(x, {
      toValue: index * segment,
      damping: 24,
      stiffness: 320,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [index, segment, x]);

  return (
    <View
      style={[styles.track, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {segment > 0 && (
        <Animated.View style={[styles.thumb, { width: segment, transform: [{ translateX: x }] }]} />
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
            style={({ pressed }) => [styles.item, pressed && !selected && styles.itemPressed]}
          >
            {opt.icon && <Icon name={opt.icon} size={16} color={selected ? colors.label : colors.secondary} />}
            <AppText
              variant="subhead"
              weight={selected ? 600 : 500}
              color={selected ? 'label' : 'secondary'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              compact
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PADDING,
    borderRadius: radii.md,
    backgroundColor: tints.gray,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  item: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
  },
  itemPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});
