import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, elevation, radii, spacing } from '../../theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  interactive?: boolean;
  elevated?: boolean;
}

/** Pure white card, 1px border (#DCE5EA), e1 elevation (or e2/e3). */
export const Card: React.FC<CardProps> = ({
  children,
  style,
  padded = true,
  interactive = false,
  elevated = false,
}) => {
  const elev = elevated ? elevation.e3 : interactive ? elevation.e2 : elevation.e1;
  return (
    <View style={[styles.card, elev, padded && styles.padded, style]}>
      {children}
    </View>
  );
};

/** Flat well container. */
export const Well: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => (
  <View style={[styles.well, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  padded: {
    padding: spacing.md,
  },
  well: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
});
