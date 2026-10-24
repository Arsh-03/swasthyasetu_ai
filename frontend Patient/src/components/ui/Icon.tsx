import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';

/**
 * Single icon family for the app: MaterialIcons, the same Google family as the
 * Doctor portal's Material Symbols. Doctor names map by swapping `_` for `-`
 * (health_and_safety → health-and-safety). The few Symbols-only glyphs use:
 *   stethoscope → medical-services, radiology / vital_signs → monitor-heart,
 *   clinical_notes → description.
 */
export type IconName = keyof typeof MaterialIcons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, color = colors.label }) => (
  <MaterialIcons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />
);
