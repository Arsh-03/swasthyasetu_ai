import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { domains, radii, tones, type Domain, type Tone } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';

export interface IconTileProps {
  /** Domain orientation category (medications, records, appointments, etc.). */
  domain?: Domain;
  /** Fallback semantic tone if domain is not specified. */
  tone?: Tone;
  icon?: IconName;
  /** Visual dimension in px (default 40) or preset ('sm' | 'md' | 'lg'). */
  size?: number | 'sm' | 'md' | 'lg';
  shape?: 'square' | 'circle';
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DOMAIN_ICONS: Record<Domain, IconName> = {
  appointments: 'calendar',
  medications: 'medication',
  records: 'records',
  privacy: 'shieldCheck',
  followup: 'rescheduled',
  emergency: 'emergency',
};

const SIZE_PRESETS: Record<'sm' | 'md' | 'lg', number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

/**
 * Domain-coloured icon tile: ~12% tint fill + duotone glyph in the domain's deep colour (≥ 3:1).
 * Replaces neumorphic discs and EmbossedIcon for clear orientation.
 */
export const IconTile: React.FC<IconTileProps> = ({
  domain,
  tone = 'primary',
  icon,
  size = 40,
  shape = 'square',
  active = true,
  style,
}) => {
  const d = domain ? domains[domain] : null;
  const t = tones[tone];

  const resolvedIcon = icon ?? (domain ? DOMAIN_ICONS[domain] : 'calendar');
  const pxSize = typeof size === 'number' ? size : SIZE_PRESETS[size] ?? 40;

  const bg = d ? d.tint : t.bg;
  const iconColor = d ? d.deep : t.icon;
  const ring = d ? d.ring : t.ring;

  const radius = shape === 'circle' ? pxSize / 2 : radii.sm;
  const iconSize = Math.round(pxSize * 0.52);

  return (
    <View
      style={[
        styles.tile,
        {
          width: pxSize,
          height: pxSize,
          borderRadius: radius,
          backgroundColor: bg,
          borderColor: ring,
        },
        style,
      ]}
    >
      <Icon name={resolvedIcon} size={iconSize} color={iconColor} active={active} />
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
