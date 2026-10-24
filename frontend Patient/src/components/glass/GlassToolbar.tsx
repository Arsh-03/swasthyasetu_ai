import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows, spacing } from '../../theme/tokens';
import { GlassSurface } from './GlassSurface';

/** Height of the toolbar row, excluding the top safe-area inset. */
export const TOOLBAR_HEIGHT = 60;

/** `.liquid-glass-toolbar`: fixed top bar that blurs the content scrolling under it. */
export const GlassToolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, shadows.sm]}>
      <GlassSurface material="toolbar" blurContent style={[styles.surface, { paddingTop: insets.top }]}>
        <View style={styles.row}>{children}</View>
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  surface: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    height: TOOLBAR_HEIGHT,
    paddingHorizontal: spacing.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
