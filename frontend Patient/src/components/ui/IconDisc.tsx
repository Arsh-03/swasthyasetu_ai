import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, neu, tones, type NeuStrength, type Tone } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
import { depth, InsetLayer, RaisedLayer } from './Neu';

interface IconDiscProps {
  icon: IconName;
  /** Glyph colour (the tone's deep variant for status tones; ≥ 3:1 on both disc fills). */
  tone?: Tone;
  size?: number;
  /** RAISED = tappable (header / tab / quick action). INSET = informational (trust, metric, status, list leading). */
  variant?: 'raised' | 'inset';
  shape?: 'circle' | 'square';
  /** Duotone glyph (default). Inactive tabs pass false for the regular weight. */
  active?: boolean;
  strength?: NeuStrength;
  style?: StyleProp<ViewStyle>;
}

/** Phosphor glyph on a neumorphic disc. Static: wrap in NeuPressable / IconButton for taps. */
export const IconDisc: React.FC<IconDiscProps> = ({
  icon,
  tone = 'primary',
  size = 44,
  variant = 'inset',
  shape = 'circle',
  active = true,
  strength,
  style,
}) => {
  const radius = shape === 'circle' ? size / 2 : Math.round(size * 0.32);
  const compact = size < 48;
  return (
    <View style={[depth.stack, styles.disc, { width: size, height: size, borderRadius: radius }, style]}>
      {variant === 'raised' ? (
        <RaisedLayer radius={radius} strength={strength ?? 'strong'} compact={compact} />
      ) : (
        <InsetLayer radius={radius} strength={strength ?? 'soft'} compact={compact} />
      )}
      <Icon
        name={icon}
        size={Math.round(size * 0.52)}
        color={tones[tone].icon}
        active={active}
        surface={variant === 'raised' ? neu.raised[strength ?? 'strong'].fill[1] : neu.inset[strength ?? 'soft'].fill[0]}
      />
    </View>
  );
};

interface EmbossedIconProps {
  icon: IconName;
  /** Decorative sizes only (≥ 32). */
  size?: number;
  color?: string;
}

const EMBOSS = 1.5;

/**
 * Large decorative icon with an extruded look: a white copy offset up-left and a shadow
 * copy offset down-right sit under the main glyph. Glyph stays primary / ink (≥ 3:1),
 * never white-on-white. Decorative: hidden from screen readers.
 */
export const EmbossedIcon: React.FC<EmbossedIconProps> = ({ icon, size = 48, color = colors.primary }) => {
  const s = Math.max(32, size);
  return (
    <View
      style={{ width: s + EMBOSS * 2, height: s + EMBOSS * 2 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.layerLight}>
        <Icon name={icon} size={s} color={neu.raised.strong.light.color} active />
      </View>
      <View style={styles.layerDark}>
        <Icon name={icon} size={s} color={neu.raised.strong.dark.color} active />
      </View>
      <View style={styles.layerMain}>
        <Icon name={icon} size={s} color={color} active />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerLight: { position: 'absolute', left: 0, top: 0 },
  layerDark: { position: 'absolute', left: EMBOSS * 2, top: EMBOSS * 2 },
  layerMain: { position: 'absolute', left: EMBOSS, top: EMBOSS },
});
