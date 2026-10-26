import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, tones, type Tone } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';

interface IconDiscProps {
  icon: IconName;
  /** Glyph colour (the tone's deep variant for status tones; ≥ 3:1 on both disc fills). */
  tone?: Tone;
  size?: number;
  variant?: 'raised' | 'inset';
  shape?: 'circle' | 'square';
  /** Duotone glyph (default). Inactive tabs pass false for the regular weight. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Clean icon disc: tint fill or white card with subtle border and duotone glyph.
 */
export const IconDisc: React.FC<IconDiscProps> = ({
  icon,
  tone = 'primary',
  size = 40,
  shape = 'circle',
  active = true,
  style,
}) => {
  const radius = shape === 'circle' ? size / 2 : radii.sm;
  const t = tones[tone];
  return (
    <View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: t.bg,
          borderColor: t.ring,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} color={t.icon} active={active} />
    </View>
  );
};

interface EmbossedIconProps {
  icon: IconName;
  size?: number;
  color?: string;
}

/**
 * Clean unembossed icon (EmbossedIcon compatibility: drops dual shadows for clean crisp glyph).
 */
export const EmbossedIcon: React.FC<EmbossedIconProps> = ({ icon, size = 40, color = colors.primary }) => (
  <Icon name={icon} size={size} color={color} active />
);

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
