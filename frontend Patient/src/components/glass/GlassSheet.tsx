import React, { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, tints } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { GlassSurface } from './GlassSurface';

interface GlassSheetProps {
  visible: boolean;
  /** Called on Android back (and backdrop tap when `closeOnBackdrop`). Omit to make the sheet non-dismissible. */
  onClose?: () => void;
  /** Also close when the dimmed backdrop is tapped. Off for sheets whose close has side effects (declining a call). */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
  /** `bottom` = iOS-style sheet with grabber, `center` = alert-style dialog. */
  placement?: 'bottom' | 'center';
  material?: 'sheet' | 'night';
  /** Darker backdrop (incoming call, SOS). */
  strongScrim?: boolean;
  style?: StyleProp<ViewStyle>;
}

const useNative = Platform.OS !== 'web';

/**
 * Glass sheet modal: blurred ink scrim behind, panel springs in from below.
 */
export const GlassSheet: React.FC<GlassSheetProps> = ({
  visible,
  onClose,
  closeOnBackdrop = false,
  children,
  placement = 'bottom',
  material = 'sheet',
  strongScrim = false,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const closeLabel = t('close');
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    Animated.spring(progress, {
      toValue: 1,
      damping: 22,
      stiffness: 260,
      mass: 0.9,
      useNativeDriver: useNative,
    }).start();
  }, [visible, progress]);

  const isBottom = placement === 'bottom';
  const backdropCloses = closeOnBackdrop && !!onClose;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [isBottom ? 60 : 16, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [isBottom ? 1 : 0.95, 1] });
  const radiusStyle = isBottom
    ? { borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }
    : { borderRadius: radii.xl };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => onClose?.()}
    >
      <View style={StyleSheet.absoluteFill}>
        {Platform.OS !== 'android' && (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        )}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: strongScrim ? colors.scrimStrong : colors.scrim }]}
          onPress={onClose}
          disabled={!backdropCloses}
          accessible={backdropCloses}
          accessibilityRole={backdropCloses ? 'button' : undefined}
          accessibilityLabel={backdropCloses ? closeLabel : undefined}
          importantForAccessibility={backdropCloses ? 'yes' : 'no-hide-descendants'}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.layout, isBottom ? styles.layoutBottom : [styles.layoutCenter, { paddingBottom: insets.bottom }]]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            isBottom ? styles.panelBottom : styles.panelCenter,
            shadows.lg,
            radiusStyle,
            { opacity: progress, transform: [{ translateY }, { scale }] },
          ]}
        >
          <GlassSurface
            material={material}
            style={[
              styles.surface,
              radiusStyle,
              isBottom && { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
              style,
            ]}
          >
            {isBottom && (
              <View
                style={[styles.grabber, material === 'night' && styles.grabberNight]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            )}
            {children}
          </GlassSurface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  layout: {
    flex: 1,
  },
  layoutBottom: {
    justifyContent: 'flex-end',
  },
  layoutCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  panelBottom: {
    width: '100%',
    maxHeight: '92%',
  },
  panelCenter: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
  },
  surface: {
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    flexShrink: 1,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.fog,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  grabberNight: {
    backgroundColor: tints.whiteStrong,
  },
});
