import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, neu, radii, spacing, touch, type NeuStrength } from '../../theme/tokens';
import { timing } from '../../theme/motion';
import { usePressScale } from '../../hooks/usePressScale';
import { haptic } from '../../utils/haptics';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { SurfaceContext } from './SurfaceContext';

/*
 * Full depth language (design_system_tokens.md § 5).
 *   RAISED = you can press it.  INSET = it holds, shows or receives something.
 *   STRONG tier for controls; SOFT tier (~58%) for panels, wells, trays and rows.
 *   Max two nesting levels; inside an inset only a raised thumb / knob is allowed.
 *
 * Rendering (no native dependency):
 *   Raised, iOS / web: two stacked shadow layers (dark +8/+8, light −8/−8) under a
 *     top-left → bottom-right highlight gradient.
 *   Raised, Android: the same gradient + a two-tone hairline edge + one tinted elevation
 *     shadow (Android ignores shadow offsets, and two blurred shadows per control are
 *     too costly on low-end phones).
 *   Inset, all platforms: reverse gradient + LinearGradient strips that fake the inner
 *     shadow (dark toward the top-left, white toward the bottom-right) + two-tone edge.
 *   Pressing cross-fades raised → inset (opacity only; shadow properties never animate).
 */

const isAndroid = Platform.OS === 'android';

/**
 * Stacking for every depth primitive. Decorative layers are absolutely positioned; on web,
 * absolute boxes paint above non-positioned siblings (react-native-svg's <svg>, RN-web's
 * <input>) regardless of order, which hid icons and input text. So: containers form a stacking
 * context (zIndex 0) and layers sit at zIndex −1, below all content on web, iOS and Android.
 */
export const depth = StyleSheet.create({
  layer: { zIndex: -1 },
  stack: { zIndex: 0 },
});
const TL = { x: 0, y: 0 };
const BR = { x: 1, y: 1 };

interface LayerProps {
  strength?: NeuStrength;
  radius: number;
  /** Halve shadow offsets for small elements (knobs, thumbs, chips, discs < 40). */
  compact?: boolean;
  /** Solid fill instead of the neutral gradient (audio badge). */
  fill?: string;
}

/** Raised surface background. Absolutely fills its parent; never intercepts touches. */
export const RaisedLayer: React.FC<LayerProps> = ({ strength = 'strong', radius, compact = false, fill }) => {
  const t = neu.raised[strength];
  const k = compact ? 0.5 : 1;
  const face = fill ? (
    <View style={[StyleSheet.absoluteFill, styles.raisedEdge, edge(t), { borderRadius: radius, backgroundColor: fill }]} />
  ) : (
    <LinearGradient
      colors={t.fill}
      start={TL}
      end={BR}
      style={[StyleSheet.absoluteFill, styles.raisedEdge, edge(t), { borderRadius: radius }]}
    />
  );

  if (isAndroid) {
    // Android paints higher-elevation siblings on top regardless of order, so the elevated face
    // lives inside a non-elevated wrapper; the wrapper (Z 0) then stays behind the content.
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, depth.layer]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, backgroundColor: neu.surface, shadowColor: t.dark.color, elevation: Math.round(t.elevation * k) },
          ]}
        >
          {face}
        </View>
      </View>
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        depth.layer,
        {
          borderRadius: radius,
          backgroundColor: neu.surface,
          shadowColor: t.dark.color,
          shadowOffset: { width: t.dark.offset * k, height: t.dark.offset * k },
          shadowOpacity: 1,
          shadowRadius: t.dark.radius * k,
        },
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: neu.surface,
            shadowColor: t.light.color,
            shadowOffset: { width: t.light.offset * k, height: t.light.offset * k },
            shadowOpacity: 1,
            shadowRadius: t.light.radius * k,
          },
        ]}
      >
        {face}
      </View>
    </View>
  );
};

const edge = (t: { edgeLight: string; edgeDark: string }) => ({
  borderTopColor: t.edgeLight,
  borderLeftColor: t.edgeLight,
  borderBottomColor: t.edgeDark,
  borderRightColor: t.edgeDark,
});

/** Inset (debossed) surface background built from gradient strips. */
export const InsetLayer: React.FC<LayerProps & { focused?: boolean }> = ({ strength = 'strong', radius, compact = false, fill, focused = false }) => {
  const t = neu.inset[strength];
  const strip = compact ? Math.round(t.depth * 0.6) : t.depth;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        depth.layer,
        styles.insetFrame,
        { borderRadius: radius, borderTopColor: t.edgeDark, borderLeftColor: t.edgeDark, borderBottomColor: t.edgeLight, borderRightColor: t.edgeLight },
      ]}
    >
      {fill ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      ) : (
        <LinearGradient colors={t.fill} start={TL} end={BR} style={StyleSheet.absoluteFill} />
      )}
      {/* Inner shadow toward the top-left */}
      <LinearGradient colors={t.dark} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.stripTop, { height: strip }]} />
      <LinearGradient colors={t.dark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.stripLeft, { width: strip }]} />
      {/* Inner highlight toward the bottom-right */}
      <LinearGradient colors={t.light} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.stripBottom, { height: strip * 0.7 }]} />
      <LinearGradient colors={t.light} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.stripRight, { width: strip * 0.7 }]} />
      {focused && <View style={[StyleSheet.absoluteFill, styles.focusRing, { borderRadius: radius }]} />}
    </View>
  );
};

interface SurfaceProps {
  children?: React.ReactNode;
  radius?: number;
  strength?: NeuStrength;
  compact?: boolean;
  /** Container style (layout and padding); the depth layers sit behind the children. */
  style?: StyleProp<ViewStyle>;
}

/** Static raised surface. Default STRONG (controls); use NeuPanel for grouped content. */
export const NeuView: React.FC<SurfaceProps & { fill?: string }> = ({ children, radius = radii.lg, strength = 'strong', compact, fill, style }) => (
  <SurfaceContext.Provider value="opaque">
    <View style={[depth.stack, { borderRadius: radius }, style]}>
      <RaisedLayer radius={radius} strength={strength} compact={compact} fill={fill} />
      {children}
    </View>
  </SurfaceContext.Provider>
);

/** SOFT raised panel for grouped content (cards, list panels). */
export const NeuPanel: React.FC<SurfaceProps & { padded?: boolean }> = ({ padded = true, style, strength = 'soft', ...rest }) => (
  <NeuView strength={strength} style={[padded && styles.panelPad, style]} {...rest} />
);

/** Inset well: inputs, text wells, list trays, toggle / segmented tracks. Default STRONG. */
export const NeuInset: React.FC<SurfaceProps & { focused?: boolean; fill?: string }> = ({
  children,
  radius = radii.lg,
  strength = 'strong',
  compact,
  focused,
  fill,
  style,
}) => (
  <SurfaceContext.Provider value="opaque">
    <View style={[depth.stack, { borderRadius: radius }, style]}>
      <InsetLayer radius={radius} strength={strength} compact={compact} focused={focused} fill={fill} />
      {children}
    </View>
  </SurfaceContext.Provider>
);

/** Debossed divider for lists: 1px dark line with a 1px white line right below. */
export const Groove: React.FC<{ inset?: number }> = ({ inset = 0 }) => (
  <View style={{ marginLeft: inset }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={styles.grooveDark} />
    <View style={styles.grooveLight} />
  </View>
);

type HapticKind = 'tap' | 'selection' | 'success' | 'heavy' | 'none';

export interface NeuPressableProps {
  onPress: () => void;
  children: React.ReactNode | ((down: boolean) => React.ReactNode);
  radius?: number;
  strength?: NeuStrength;
  compact?: boolean;
  /** Latched pressed state (selected tile, muted mic): stays inset. */
  selected?: boolean;
  /** Draw a primary accent bar on the leading edge when selected (list rows). */
  accentBar?: boolean;
  /** Rows: no raised layer at rest (they live inside a panel), inset only while pressed / selected. */
  flatAtRest?: boolean;
  fill?: string;
  disabled?: boolean;
  haptics?: HapticKind;
  hitSlop?: number;
  /** Surface style (size, padding, content layout). */
  style?: StyleProp<ViewStyle>;
  /** Outer layout (flex, margins, alignSelf). */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Grow to fill the wrapper's height, so tiles stretched by their row end up the same height.
   * Only for equal-height tile rows (ChoiceTiles, Home quick actions); everything else keeps its intrinsic height.
   */
  fillHeight?: boolean;
  accessibilityRole?: 'button' | 'checkbox' | 'switch' | 'tab' | 'radio';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean; busy?: boolean };
}

/** Raised surface that animates to inset while pressed (and stays inset when `selected`). */
export const NeuPressable: React.FC<NeuPressableProps> = ({
  onPress,
  children,
  radius = radii.md,
  strength = 'strong',
  compact,
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
}) => {
  const press = usePressScale(0.985);
  const down = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    down.set(withTiming(selected ? 1 : 0, timing.press));
  }, [selected, down]);

  const raisedStyle = useAnimatedStyle(() => ({ opacity: 1 - down.get() }));
  const insetStyle = useAnimatedStyle(() => ({ opacity: down.get() }));

  return (
    <Animated.View style={[press.style, disabled && styles.disabled, containerStyle]}>
      <Pressable
        onPress={() => {
          if (haptics !== 'none') haptic[haptics]();
          onPress();
        }}
        onPressIn={() => {
          press.onPressIn();
          down.set(withTiming(1, timing.press));
        }}
        onPressOut={() => {
          press.onPressOut();
          if (!selected) down.set(withTiming(0, timing.press));
        }}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, ...(accessibilityRole === 'button' ? { selected } : null), ...accessibilityState }}
        style={[depth.stack, fillHeight && styles.pressableFill, { borderRadius: radius }, style]}
      >
        {({ pressed }) => (
          <SurfaceContext.Provider value="opaque">
            {!flatAtRest && (
              <Animated.View style={[StyleSheet.absoluteFill, depth.layer, raisedStyle]} pointerEvents="none">
                <RaisedLayer radius={radius} strength={strength} compact={compact} fill={fill} />
              </Animated.View>
            )}
            <Animated.View style={[StyleSheet.absoluteFill, depth.layer, insetStyle]} pointerEvents="none">
              <InsetLayer radius={radius} strength={strength} compact={compact} fill={fill} />
            </Animated.View>
            {accentBar && selected && <View style={[styles.accentBar, { borderRadius: 2 }]} pointerEvents="none" />}
            {typeof children === 'function' ? children(pressed || selected) : children}
          </SurfaceContext.Provider>
        )}
      </Pressable>
    </Animated.View>
  );
};

interface NeuButtonProps {
  icon: IconName;
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  selected?: boolean;
  /** Diameter for icon-only buttons. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Tactile control button (strong). Icon-only = round. */
export const NeuButton: React.FC<NeuButtonProps> = ({ icon, label, onPress, accessibilityLabel, selected = false, size = 56, style }) => {
  const round = !label;
  return (
    <NeuPressable
      onPress={onPress}
      selected={selected}
      radius={round ? size / 2 : radii.md}
      compact={round && size < 40}
      hitSlop={round ? Math.max(0, (touch.min - size) / 2) : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.buttonContent, round ? { width: size, height: size } : styles.buttonLabelled, style]}
    >
      {(down) => (
        <>
          <Icon name={icon} size={round ? Math.round(size * 0.42) : 22} color={down ? colors.primary : colors.ink} active={down} />
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

const TRACK_W = 60;
const TRACK_H = 34;
const KNOB = 26;
const TRAVEL = TRACK_W - KNOB - 8;

interface NeuToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

/** Switch: inset track with a raised knob. On = primary ring + check in the knob. */
export const NeuToggle: React.FC<NeuToggleProps> = ({ value, onValueChange, accessibilityLabel, disabled = false }) => {
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? TRAVEL : 0, timing.transition) }],
  }));
  return (
    <Pressable
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
      <NeuInset radius={TRACK_H / 2} compact focused={value} style={styles.track}>
        <Animated.View style={knobStyle}>
          <NeuView radius={KNOB / 2} compact style={styles.knob}>
            {value && <Icon name="check" size={16} color={colors.primary} />}
          </NeuView>
        </Animated.View>
      </NeuInset>
    </Pressable>
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

/** Square tactile tile (dose tiles). Selected = inset + duotone primary icon + check badge. */
export const NeuTile: React.FC<NeuTileProps> = ({ icon, label, sublabel, selected, onPress, accessibilityLabel, style }) => (
  <View style={style}>
    <NeuPressable
      onPress={onPress}
      selected={selected}
      radius={radii.lg}
      haptics={selected ? 'tap' : 'success'}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? [label, sublabel].filter(Boolean).join(', ')}
      style={styles.tile}
    >
      {(down) => (
        <>
          {selected && (
            <View style={styles.tileCheck}>
              <Icon name="check" size={14} color={colors.onPrimary} />
            </View>
          )}
          <Icon name={icon} size={30} color={down ? colors.primary : colors.ink} active={down} />
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

/**
 * List container: `panel` = soft raised (tappable rows), `tray` = soft inset (read-only rows,
 * e.g. audit ledger). Rows are separated by grooves; only the container carries a shadow.
 */
export const NeuList: React.FC<{ variant?: 'panel' | 'tray'; children: React.ReactNode; grooveInset?: number; style?: StyleProp<ViewStyle> }> = ({
  variant = 'panel',
  children,
  grooveInset = 0,
  style,
}) => {
  const items = React.Children.toArray(children).filter(Boolean);
  const body = items.map((child, i) => (
    <React.Fragment key={i}>
      {i > 0 && <Groove inset={grooveInset} />}
      {child}
    </React.Fragment>
  ));
  return variant === 'tray' ? (
    <NeuInset strength="soft" style={[styles.list, style]}>
      {body}
    </NeuInset>
  ) : (
    <NeuPanel padded={false} style={[styles.list, style]}>
      {body}
    </NeuPanel>
  );
};

const styles = StyleSheet.create({
  pressableFill: {
    flexGrow: 1,
  },
  raisedEdge: {
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  insetFrame: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  stripTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  stripLeft: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  stripBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  stripRight: { position: 'absolute', top: 0, right: 0, bottom: 0 },
  focusRing: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  panelPad: {
    padding: spacing.lg,
  },
  grooveDark: {
    height: 1,
    backgroundColor: neu.groove.dark,
  },
  grooveLight: {
    height: 1,
    backgroundColor: neu.groove.light,
  },
  accentBar: {
    position: 'absolute',
    left: 4,
    top: 10,
    bottom: 10,
    width: 4,
    backgroundColor: neu.accent,
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonLabelled: {
    minHeight: touch.min + 4,
    paddingHorizontal: spacing.xl,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  tileCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    overflow: 'visible',
  },
  disabled: {
    opacity: 0.5,
  },
});
