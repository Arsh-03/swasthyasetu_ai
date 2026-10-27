import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../utils/haptics';
import { colors, radii, spacing, touch } from '../../theme/tokens';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/AppText';
import { Speakable } from '../../speech/Speakable';
import { useScripts, type TabKey } from '../../speech/scripts';
import { GlassSurface } from './GlassSurface';

/** Docked bottom tab bar height (compact, no floating waste). */
export const TAB_BAR_HEIGHT = 54;

/** Space content must leave at bottom so content is never hidden behind the tab bar. */
export const tabBarChromeHeight = (bottomInset: number) => TAB_BAR_HEIGHT + Math.max(bottomInset, 8);

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
              tabKey={tab.key}
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
  );
}

export const TabItem: React.FC<{
  tabKey?: string;
  label: string;
  icon: IconName;
  active: boolean;
  onPress: () => void;
  /** Unread count, shown as a small red badge on the icon. */
  badge?: number;
}> = ({ tabKey, label, icon, active, onPress, badge }) => {
  const scripts = useScripts();
  // "Medications. See the medicines you need to take." (+ unread messages on Chat)
  const speech = () => {
    const known = tabKey && tabKey in scripts.tabs ? scripts.tabs[tabKey as TabKey] : scripts.common.tab(label, active);
    return `${known}${badge ? scripts.tabs.unread(badge) : ''}`;
  };

  return (
    <Speakable
        atomic
        speech={speech}
        radius={radii.lg}
        onPress={() => {
          if (!active) haptic.selection();
          onPress();
        }}
        style={({ pressed }) => [styles.item, pressed && !active && styles.pressed]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={badge ? `${label} (${badge})` : label}
      >
        <View style={[styles.pill, active && styles.activePill]}>
          {badge ? (
            <View style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
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
      </Speakable>
  );
};

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
  // Icon above the label: five tabs fit side by side even on small phones and with Kannada / Hindi labels.
  pill: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.lg,
    maxWidth: '100%',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.dangerDeep,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '700' },
  activePill: {
    backgroundColor: 'rgba(62, 105, 133, 0.12)', // primary tint pill
  },
  pressed: {
    opacity: 0.6,
  },
});
