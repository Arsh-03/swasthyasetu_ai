import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme/tokens';
import { AppText } from './AppText';
import { Badge } from './Badge';

interface SectionHeaderProps {
  title: string;
  /** Shown as a blue count pill, like the Doctor's "4 Waiting" tag. */
  count?: number;
  right?: React.ReactNode;
}

/** Uppercase eyebrow section label with an optional count pill. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, count, right }) => (
  <View style={styles.row} accessibilityRole="header">
    <View style={styles.left}>
      <AppText variant="eyebrow" color="inkMuted" style={styles.title}>
        {title}
      </AppText>
      {count !== undefined && <Badge label={String(count)} tone="primary" />}
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  title: {
    flexShrink: 1,
  },
});
