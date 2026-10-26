import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors, radii } from '../../theme/tokens';
import type { MedicationForm } from '../../utils/medicationInfo';

interface MedicationFormTileProps {
  form: MedicationForm;
  size?: number;
  active?: boolean;
}

export const MedicationFormTile: React.FC<MedicationFormTileProps> = ({
  form,
  size = 52,
  active = false,
}) => {
  const getColors = () => {
    switch (form) {
      case 'syrup':
        return {
          bg: '#EAF5F8',
          border: '#CDE5EB',
          primary: colors.teal,
          accent: colors.tealDeep,
        };
      case 'capsule':
        return {
          bg: '#F5F0FF',
          border: '#E1D5F8',
          primary: colors.primary,
          accent: colors.primaryDeep,
        };
      case 'drops':
        return {
          bg: '#EAF0FA',
          border: '#D0DFFA',
          primary: colors.navy,
          accent: colors.navyDeep,
        };
      case 'injection':
        return {
          bg: '#FEF3E8',
          border: '#F9DFBF',
          primary: colors.warning,
          accent: colors.warningDeep,
        };
      case 'tablet':
      default:
        return {
          bg: '#EBF6F5',
          border: '#CFEBE8',
          primary: colors.teal,
          accent: colors.tealDeep,
        };
    }
  };

  const scheme = getColors();

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: scheme.bg,
          borderColor: scheme.border,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 40 40">
        {form === 'tablet' && (
          <G>
            {/* Round tablet with bevel score */}
            <Circle cx={20} cy={20} r={15} fill={scheme.primary} fillOpacity={0.88} />
            <Circle cx={20} cy={20} r={14} stroke={scheme.accent} strokeWidth={1.5} fill="none" opacity={0.3} />
            {/* Center score groove line */}
            <Path d="M9 20h22" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
            <Path d="M12 12c3-3 7-4 12-3" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.65} />
          </G>
        )}

        {form === 'syrup' && (
          <G>
            {/* Syrup bottle with neck and liquid fill */}
            <Rect x={14} y={5} width={12} height={4} rx={1.5} fill={scheme.accent} />
            <Rect x={17} y={9} width={6} height={4} fill={scheme.accent} fillOpacity={0.5} />
            <Rect x={10} y={13} width={20} height={22} rx={4} fill={scheme.primary} fillOpacity={0.85} />
            {/* Bottle liquid wave/level */}
            <Path d="M12 21c3-1.5 5 1.5 8 0s5-1.5 8 0v11a3 3 0 01-3 3H15a3 3 0 01-3-3V21z" fill={scheme.accent} fillOpacity={0.5} />
            {/* Measurement lines */}
            <Path d="M13 18h4M13 23h3M13 28h4" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
            {/* Shine */}
            <Path d="M26 16v12" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
          </G>
        )}

        {form === 'capsule' && (
          <G transform="rotate(-30 20 20)">
            {/* Capsule left half */}
            <Path d="M11 20a9 9 0 019-9h0v18h0a9 9 0 01-9-9z" fill={colors.teal} />
            {/* Capsule right half */}
            <Path d="M20 11h0a9 9 0 019 9 9 9 0 01-9 9h0V11z" fill={colors.goldDeep} />
            {/* Dividing seam */}
            <Path d="M20 11v18" stroke="#FFFFFF" strokeWidth={2} opacity={0.75} />
            {/* Shine highlight */}
            <Path d="M14 14c2-1.5 5-2 9-1.5" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.65} />
          </G>
        )}

        {form === 'drops' && (
          <G>
            {/* Dropper bulb & pipet */}
            <Path d="M17 6h6v4h-6z" fill={scheme.accent} />
            <Path d="M18 10h4v9h-4z" fill={scheme.accent} fillOpacity={0.6} />
            <Path d="M19 19l1 4 1-4z" fill={scheme.accent} />
            {/* Falling drop */}
            <Path d="M20 26c-3 4-4 6-4 8a4 4 0 008 0c0-2-1-4-4-8z" fill={scheme.primary} />
          </G>
        )}

        {form === 'injection' && (
          <G transform="rotate(45 20 20)">
            <Rect x={18} y={4} width={4} height={8} fill={scheme.accent} />
            <Rect x={16} y={12} width={8} height={18} rx={2} fill={scheme.primary} fillOpacity={0.8} />
            <Path d="M20 30v7" stroke={scheme.accent} strokeWidth={1.5} />
            <Path d="M18 16h4M18 20h3M18 24h4" stroke="#FFFFFF" strokeWidth={1.2} />
          </G>
        )}
      </Svg>
    </View>
  );
};

interface MedicationFormHeroProps {
  form: MedicationForm;
  width?: number;
  height?: number;
}

export const MedicationFormHero: React.FC<MedicationFormHeroProps> = ({
  form,
  width = 150,
  height = 110,
}) => {
  return (
    <View style={styles.heroWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox="0 0 160 120">
        <Defs>
          <LinearGradient id="heroGradTeal" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#407E8C" />
            <Stop offset="100%" stopColor="#215661" />
          </LinearGradient>
          <LinearGradient id="heroGradGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#D49A38" />
            <Stop offset="100%" stopColor="#A6731B" />
          </LinearGradient>
        </Defs>

        {/* Soft organic ambient blob */}
        <Path
          d="M80 14c32 0 64 16 68 46s-12 56-42 66-64 8-84-10-8-50 4-76 40-26 54-26z"
          fill={colors.ice}
          fillOpacity={0.85}
        />
        <Circle cx={130} cy={30} r={7} fill={colors.sand} fillOpacity={0.8} />
        <Circle cx={28} cy={88} r={5} fill={colors.fog} fillOpacity={0.8} />

        {form === 'tablet' && (
          <G>
            {/* Tilted, large modern tablet with relief shadow */}
            <Circle cx={82} cy={64} r={36} fill="#000000" fillOpacity={0.06} />
            <Circle cx={80} cy={60} r={36} fill="url(#heroGradTeal)" />
            <Circle cx={80} cy={60} r={34} stroke="#FFFFFF" strokeWidth={2.5} fill="none" opacity={0.25} />
            {/* Center score groove */}
            <Path d="M52 60h56" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" />
            <Path d="M52 61.5h56" stroke="#000000" strokeWidth={1} strokeLinecap="round" opacity={0.2} />
            {/* Bevel arc highlight */}
            <Path d="M60 40c12-8 28-8 40 0" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
          </G>
        )}

        {form === 'syrup' && (
          <G>
            {/* Syrup bottle with shadow */}
            <Rect x={55} y={32} width={50} height={64} rx={10} fill="#000000" fillOpacity={0.06} />
            {/* Cap */}
            <Rect x={66} y={16} width={28} height={10} rx={3} fill="#215661" />
            <Rect x={73} y={26} width={14} height={7} fill="#407E8C" />
            {/* Bottle body */}
            <Rect x={55} y={30} width={50} height={64} rx={10} fill="url(#heroGradTeal)" />
            {/* Measurement window */}
            <Rect x={61} y={42} width={38} height={44} rx={6} fill="#FFFFFF" fillOpacity={0.22} />
            <Path d="M65 52h8M65 62h14M65 72h8" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
            {/* Liquid drop next to bottle */}
            <Path d="M120 72c-4 6-6 9-6 12a6 6 0 0012 0c0-3-2-6-6-12z" fill="#D49A38" />
          </G>
        )}

        {form === 'capsule' && (
          <G transform="rotate(-35 80 60)">
            {/* Shadow */}
            <Rect x={44} y={46} width={76} height={34} rx={17} fill="#000000" fillOpacity={0.06} />
            {/* Left teal cap */}
            <Path d="M58 44a17 17 0 00-17 17 17 17 0 0017 17h22V44H58z" fill="url(#heroGradTeal)" />
            {/* Right golden cap */}
            <Path d="M80 44h22a17 17 0 0117 17 17 17 0 01-17 17H80V44z" fill="url(#heroGradGold)" />
            {/* Dividing seam */}
            <Path d="M80 44v34" stroke="#FFFFFF" strokeWidth={3.5} opacity={0.8} />
            {/* Highlighting shine */}
            <Path d="M50 49c8-3 20-3 30 0" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.65} />
          </G>
        )}

        {form === 'drops' && (
          <G>
            <Rect x={68} y={20} width={24} height={12} rx={3} fill="#215661" />
            <Path d="M76 32h8v16h-8z" fill="#407E8C" />
            <Path d="M78 48l2 8 2-8z" fill="#215661" />
            {/* Droplet */}
            <Path d="M80 66c-5 8-8 12-8 16a8 8 0 0016 0c0-4-3-8-8-16z" fill="url(#heroGradTeal)" />
          </G>
        )}

        {form === 'injection' && (
          <G transform="rotate(35 80 60)">
            <Rect x={76} y={15} width={8} height={18} fill="#215661" />
            <Rect x={72} y={33} width={16} height={46} rx={4} fill="url(#heroGradTeal)" />
            <Path d="M80 79v20" stroke="#215661" strokeWidth={2.5} />
            <Path d="M74 44h8M74 54h6M74 64h8" stroke="#FFFFFF" strokeWidth={2} />
          </G>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
});
