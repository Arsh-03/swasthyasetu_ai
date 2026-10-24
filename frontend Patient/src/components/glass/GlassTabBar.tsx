import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../utils/haptics';
import { colors, radii, tints, touch } from '../../theme/tokens';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/AppText';
import { GlassSurface } from './GlassSurface';

/** Height of the tab row, excluding the bottom safe-area inset. */
export const TAB_BAR_HEIGHT = 60;

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

/** Bottom tab bar in the toolbar glass material, with the segmented-control "selected pill" look. */
export function GlassTabBar<K extends string>({ tabs, activeKey, onChange }: GlassTabBarProps<K>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.wrap}>
      <GlassSurface
        material="toolbar"
        blurContent
        style={[styles.surface, { paddingBottom: Math.max(insets.bottom, 6) }]}
        accessibilityRole="tablist"
      >
        <View style={styles.row}>
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  if (!active) haptic.selection();
                  onChange(tab.key);
                }}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
              >
                <View style={[styles.iconPill, active && styles.iconPillActive]}>
                  <Icon name={tab.icon} size={22} color={active ? colors.blue : colors.tertiary} />
                </View>
                <AppText
                  variant="caption"
                  weight={active ? 600 : 500}
                  color={active ? 'blue' : 'tertiary'}
                  numberOfLines={1}
                  compact
                >
                  {tab.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  surface: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
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
  iconPill: {
    width: 52,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: tints.blue,
  },
});
