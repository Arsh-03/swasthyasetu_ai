import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing } from '../../theme/tokens';
import { NeuInset, NeuPanel } from './Neu';

/** Grouped content: SOFT raised panel (every boxed element has depth). */
export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }> = ({
  children,
  style,
  padded = true,
}) => (
  <NeuPanel padded={padded} style={style}>
    {children}
  </NeuPanel>
);

/** Read-only text / detail well: SOFT inset. Only raised thumbs or knobs may sit inside. */
export const Well: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <NeuInset strength="soft" radius={radii.md} style={[{ padding: spacing.md + 2 }, style]}>
    {children}
  </NeuInset>
);
