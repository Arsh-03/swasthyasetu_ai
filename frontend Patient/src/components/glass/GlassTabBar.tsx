import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../utils/haptics';
import { colors, radii, spacing, touch } from '../../theme/tokens';
import { Icon, type IconName } from '../ui/Icon';
import { IconDisc } from '../ui/IconDisc';
import { AppText } from '../ui/AppText';
import { GlassSurface } from './GlassSurface';

/** Height of the floating pill itself. */
export const TAB_BAR_HEIGHT = 68;
const SIDE_MARGIN = spacing.lg;

/** Distance from the screen bottom to the pill's bottom edge. */
const floatOffset = (bottomInset: number) => Math.max(bottomInset, spacing.md) + spacing.xs;

/** Space content must leave at the bottom so nothing hides behind the floating tab bar. */
export const tabBarChromeHeight = (bottomInset: number) => TAB_BAR_HEIGHT + floatOffset(bottomInset) + spacing.sm;

export interface GlassTab<K extends string> {
  key: K;
  label: string;
  icon: IconName;
  /** Unread count shown as a small badge on the icon. */
  badge?: number;
}

interface GlassTabBarProps<K extends string> {
  tabs: GlassTab<K>[];
  activeKey: K;
  onChange: (key: K) => void;
}

/**
 * Floating glass pill. Active tab = raised disc with a duotone glyph + bold ink label;
 * inactive = regular-weight glyph. Ink text only (it sits on glass).
 */
export function GlassTabBar<K extends string>({ tabs, activeKey, onChange }: GlassTabBarProps<K>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: floatOffset(insets.bottom) }]} pointerEvents="box-none">
      <View style={styles.shadow}>
        <GlassSurface material="tabBar" blurContent style={styles.surface} accessibilityRole="tablist">
          <View style={styles.row}>
            {tabs.map((tab) => (
              <TabItem
                key={tab.key}
                label={tab.label}
                icon={tab.icon}
                badge={tab.badge}
                active={tab.key === activeKey}
                onPress={() => onChange(tab.key)}
              />
            ))}
          </View>
        </GlassSurface>
      </View>
    </View>
  );
}

/** One tab: active = raised disc + duotone glyph + bold label; inactive = regular glyph. */
export const TabItem: React.FC<{ label: string; icon: IconName; active: boolean; onPress: () => void; badge?: number }> = ({ label, icon, active, onPress, badge }) => (
  <Pressable
    onPress={() => {
      if (!active) haptic.selection();
      onPress();
    }}
    style={({ pressed }) => [styles.item, pressed && !active && styles.pressed]}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
    accessibilityLabel={badge ? `${label} (${badge})` : label}
  >
    {badge ? (
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
      </View>
    ) : null}
    {active ? (
      <IconDisc icon={icon} variant="raised" size={38} active />
    ) : (
      <View style={styles.iconSlot}>
        <Icon name={icon} size={24} color={colors.inkMuted} surface={colors.glassTabBar} />
      </View>
    )}
    <AppText variant="caption" weight={active ? 700 : 500} color="ink" numberOfLines={1} compact>
      {label}
    </AppText>
  </Pressable>
);

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.dangerDeep,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
  wrap: {
    position: 'absolute',
    left: SIDE_MARGIN,
    right: SIDE_MARGIN,
    zIndex: 50,
  },
  shadow: {
    borderRadius: radii.xl,
    // Soft coloured shadow under the pill (single layer: it floats over everything)
    ...(Platform.OS === 'android'
      ? { elevation: 10, shadowColor: colors.primary }
      : { shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20 }),
  },
  surface: {
    borderRadius: radii.xl,
  },
  row: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  item: {
    flex: 1,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  iconSlot: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
