import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../utils/haptics';
import { colors, radii, spacing, touch } from '../../theme/tokens';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/AppText';
import { GlassSurface } from './GlassSurface';

/** Docked bottom tab bar height (compact, no floating waste). */
export const TAB_BAR_HEIGHT = 54;

/** Space content must leave at bottom so content is never hidden behind the tab bar. */
export const tabBarChromeHeight = (bottomInset: number) => TAB_BAR_HEIGHT + Math.max(bottomInset, 8);

export interface GlassTab<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

interface GlassTabBarProps<K extends string> {
  tabs: GlassTab<K>[];
  activeKey: K;
  onChange: (key: K) => void;
}

/**
 * Docked clean bottom tab bar with subtle glass (fill ~0.85, light blur, hairline top border).
 * Active tab: solid tinted pill + duotone primary icon + bold label.
 */
export function GlassTabBar<K extends string>({ tabs, activeKey, onChange }: GlassTabBarProps<K>) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 6);

  return (
    <View style={styles.dockWrap} pointerEvents="box-none">
      <GlassSurface material="tabBar" blurContent style={[styles.surface, { paddingBottom: bottomPad }]} accessibilityRole="tablist">
        <View style={styles.row}>
          {tabs.map((tab) => (
            <TabItem
              key={tab.key}
              label={tab.label}
              icon={tab.icon}
              active={tab.key === activeKey}
              onPress={() => onChange(tab.key)}
            />
          ))}
        </View>
      </GlassSurface>
    </View>
  );
}

export const TabItem: React.FC<{
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
}> = ({ label, icon, active, onPress }) => (
  <Pressable
    onPress={() => {
      if (!active) haptic.selection();
      onPress();
    }}
    style={({ pressed }) => [styles.item, pressed && !active && styles.pressed]}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    accessibilityLabel={label}
  >
    <View style={[styles.pill, active && styles.activePill]}>
      <Icon
        name={icon}
        size={20}
        color={active ? colors.primary : colors.inkMuted}
        active={active}
      />
      <AppText
        variant="caption"
        weight={active ? 700 : 500}
        color={active ? 'primary' : 'inkMuted'}
        numberOfLines={1}
        compact
      >
        {label}
      </AppText>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  surface: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  row: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  item: {
    flex: 1,
    minHeight: touch.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  activePill: {
    backgroundColor: 'rgba(62, 105, 133, 0.12)', // primary tint pill
  },
  pressed: {
    opacity: 0.6,
  },
});
