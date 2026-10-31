import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, elevation, radii, spacing, touch } from '../../theme/tokens';
import { timing } from '../../theme/motion';
import { usePressScale } from '../../hooks/usePressScale';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { SurfaceContext } from './SurfaceContext';
import { Speakable, type SpeechSource } from '../../speech/Speakable';
import { useScripts } from '../../speech/scripts';

export const depth = StyleSheet.create({
  layer: { zIndex: -1 },
  stack: { zIndex: 0 },
});

export type NeuStrength = 'soft' | 'strong';

interface LayerProps {
  strength?: NeuStrength;
  radius: number;
  compact?: boolean;
  fill?: string;
}

/** Clean surface layer: white card face with subtle 1px border. */
export const RaisedLayer: React.FC<LayerProps> = ({ radius, fill }) => (
  <View
    pointerEvents="none"
    style={[
      StyleSheet.absoluteFill,
      depth.layer,
      styles.cardFace,
      {
        borderRadius: radius,
        backgroundColor: fill ?? colors.card,
        borderColor: colors.cardBorder,
      },
      elevation.e1,
    ]}
  />
);

/** Clean inset/well layer: input border without faux shadow strips. */
export const InsetLayer: React.FC<LayerProps & { focused?: boolean }> = ({ radius, fill, focused = false }) => (
  <View
    pointerEvents="none"
    style={[
      StyleSheet.absoluteFill,
      depth.layer,
      {
        borderRadius: radius,
        backgroundColor: fill ?? colors.card,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? colors.primary : colors.inputBorder,
      },
    ]}
  />
);

interface SurfaceProps {
  children?: React.ReactNode;
  radius?: number;
  strength?: NeuStrength;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Clean Card/Panel container (white, 1px border, e1 shadow). */
export const NeuView: React.FC<SurfaceProps & { fill?: string }> = ({
  children,
  radius = radii.lg,
  fill,
  style,
}) => (
  <SurfaceContext.Provider value="opaque">
    <View
      style={[
        styles.cardFace,
        {
          borderRadius: radius,
          backgroundColor: fill ?? colors.card,
          borderColor: colors.cardBorder,
        },
        elevation.e1,
        style,
      ]}
    >
      {children}
    </View>
  </SurfaceContext.Provider>
);

export const NeuPanel: React.FC<SurfaceProps & { padded?: boolean; fill?: string }> = ({
  padded = true,
  style,
  ...rest
}) => (
  <NeuView style={[padded && styles.panelPad, style]} {...rest} />
);

/** Well/Container: subtle 1px border. */
export const NeuInset: React.FC<SurfaceProps & { focused?: boolean; fill?: string }> = ({
  children,
  radius = radii.md,
  focused = false,
  fill,
  style,
}) => (
  <SurfaceContext.Provider value="opaque">
    <View
      style={[
        styles.wellFace,
        {
          borderRadius: radius,
          backgroundColor: fill ?? colors.card,
          borderColor: focused ? colors.primary : colors.inputBorder,
          borderWidth: focused ? 2 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  </SurfaceContext.Provider>
);

/** Clean 1px hairline divider. */
export const Groove: React.FC<{ inset?: number }> = ({ inset = 0 }) => (
  <View style={[styles.hairlineDivider, { marginLeft: inset }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
);

export interface NeuPressableProps {
  onPress: () => void;
  children: React.ReactNode | ((down: boolean) => React.ReactNode);
  radius?: number;
  strength?: NeuStrength;
  compact?: boolean;
  selected?: boolean;
  accentBar?: boolean;
  flatAtRest?: boolean;
  fill?: string;
  disabled?: boolean;
  haptics?: 'tap' | 'selection' | 'success' | 'heavy' | 'none';
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  fillHeight?: boolean;
  accessibilityRole?: 'button' | 'checkbox' | 'switch' | 'tab' | 'radio';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean; busy?: boolean };
  /** Spoken on double tap. Without it: a card reads each text inside on its own; a control reads its label. */
  speech?: SpeechSource;
  /** One control (button, chip): text inside does not speak separately. Cards leave this off. */
  atomic?: boolean;
}

/** Clean pressable surface: scale 0.98 on press, elevates from e1 to e2. */
export const NeuPressable: React.FC<NeuPressableProps> = ({
  onPress,
  children,
  radius = radii.md,
  selected = false,
  accentBar = false,
  flatAtRest = false,
  fill,
  disabled = false,
  haptics = 'tap',
  hitSlop,
  style,
  containerStyle,
  fillHeight = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  speech,
  atomic = false,
}) => {
  const press = usePressScale(0.98);

  return (
    <Animated.View style={[press.style, disabled && styles.disabled, containerStyle]}>
      <Speakable
        speech={speech}
        atomic={atomic}
        onPress={() => {
          if (haptics !== 'none') haptic[haptics]();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, ...(accessibilityRole === 'button' ? { selected } : null), ...accessibilityState }}
        style={({ pressed }) => [
          styles.cardFace,
          {
            borderRadius: radius,
            backgroundColor: selected ? colors.ice : fill ?? colors.card,
            borderColor: selected ? colors.primary : colors.cardBorder,
          },
          !flatAtRest && (pressed || selected ? elevation.e2 : elevation.e1),
          fillHeight && styles.pressableFill,
          style,
        ]}
      >
        {({ pressed }) => (
          <SurfaceContext.Provider value="opaque">
            {accentBar && selected && <View style={styles.accentBar} pointerEvents="none" />}
            {typeof children === 'function' ? children(pressed || selected) : children}
          </SurfaceContext.Provider>
        )}
      </Speakable>
    </Animated.View>
  );
};

interface NeuButtonProps {
  icon: IconName;
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  selected?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const NeuButton: React.FC<NeuButtonProps> = ({
  icon,
  label,
  onPress,
  accessibilityLabel,
  selected = false,
  size = 48,
  style,
}) => {
  const round = !label;
  return (
    <NeuPressable
      onPress={onPress}
      atomic
      selected={selected}
      radius={round ? size / 2 : radii.md}
      hitSlop={round ? Math.max(0, (touch.min - size) / 2) : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.buttonContent, round ? { width: size, height: size } : styles.buttonLabelled, style]}
    >
      {(down) => (
        <>
          <Icon name={icon} size={round ? 22 : 20} color={down ? colors.primary : colors.ink} active={down} />
          {label ? (
            <AppText variant="callout" weight={600} color={down ? 'primary' : 'ink'} compact>
              {label}
            </AppText>
          ) : null}
        </>
      )}
    </NeuPressable>
  );
};

const TRACK_W = 52;
const TRACK_H = 30;
const KNOB = 24;
const TRAVEL = TRACK_W - KNOB - 6;

interface NeuToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Spoken on double tap (default: "<label>. It is on. Tap to turn it off."). */
  speech?: SpeechSource;
}

/** Clean standard switch toggle. */
export const NeuToggle: React.FC<NeuToggleProps> = ({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  speech,
}) => {
  const scripts = useScripts();
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? TRAVEL : 0, timing.transition) }],
  }));

  return (
    <Speakable
      atomic
      speech={speech ?? (() => scripts.common.toggle(accessibilityLabel, value))}
      onPress={() => {
        haptic.selection();
        onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={(touch.min - TRACK_H) / 2}
      style={disabled && styles.disabled}
    >
      <View style={[styles.track, { backgroundColor: value ? colors.primary : '#DCE5EA' }]}>
        <Animated.View style={knobStyle}>
          <View style={[styles.knob, elevation.e1]}>
            {value && <Icon name="check" size={14} color={colors.primary} />}
          </View>
        </Animated.View>
      </View>
    </Speakable>
  );
};

interface NeuTileProps {
  icon: IconName;
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const NeuTile: React.FC<NeuTileProps> = ({
  icon,
  label,
  sublabel,
  selected,
  onPress,
  accessibilityLabel,
  style,
}) => (
  <View style={style}>
    <NeuPressable
      onPress={onPress}
      selected={selected}
      radius={radii.md}
      haptics={selected ? 'tap' : 'success'}
      atomic
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? [label, sublabel].filter(Boolean).join(', ')}
      style={styles.tile}
    >
      {(down) => (
        <>
          {selected && (
            <View style={styles.tileCheck}>
              <Icon name="check" size={13} color={colors.onPrimary} />
            </View>
          )}
          <Icon name={icon} size={28} color={down ? colors.primary : colors.ink} active={down} />
          <AppText variant="subhead" weight={600} color={down ? 'primary' : 'ink'} align="center" compact>
            {label}
          </AppText>
          {sublabel ? (
            <AppText variant="caption" color="inkMuted" align="center" compact>
              {sublabel}
            </AppText>
          ) : null}
        </>
      )}
    </NeuPressable>
  </View>
);

export const NeuList: React.FC<{
  variant?: 'panel' | 'tray';
  children: React.ReactNode;
  grooveInset?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ children, grooveInset = 0, style }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  const body = items.map((child, i) => (
    <React.Fragment key={i}>
      {i > 0 && <Groove inset={grooveInset} />}
      {child}
    </React.Fragment>
  ));
  return (
    <View style={[styles.list, elevation.e1, style]}>
      {body}
    </View>
  );
};

/* Neutral component re-exports */
export const Panel = NeuPanel;
export const Tile = NeuTile;
export const Toggle = NeuToggle;

const styles = StyleSheet.create({
  cardFace: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  wellFace: {
    borderWidth: 1,
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: colors.separator,
  },
  panelPad: {
    padding: spacing.md,
  },
  pressableFill: {
    flexGrow: 1,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: colors.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonLabelled: {
    minHeight: touch.min,
    paddingHorizontal: spacing.lg,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tile: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  tileCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
});
