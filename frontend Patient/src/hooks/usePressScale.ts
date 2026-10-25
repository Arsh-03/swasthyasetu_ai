import { useCallback } from 'react';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { PRESS_SCALE, pressSpring } from '../theme/motion';

/**
 * Press feedback for tactile controls: scales down on press-in and springs back.
 * Only transform is animated (never shadows). With reduce-motion on, the scale is
 * skipped and controls rely on their pressed colour / inset state instead.
 *
 *   const press = usePressScale();
 *   <Animated.View style={press.style}><Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut} /></Animated.View>
 */
export const usePressScale = (to: number = PRESS_SCALE) => {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const onPressIn = useCallback(() => {
    if (!reduceMotion) scale.set(withSpring(to, pressSpring));
  }, [reduceMotion, scale, to]);

  const onPressOut = useCallback(() => {
    if (!reduceMotion) scale.set(withSpring(1, pressSpring));
  }, [reduceMotion, scale]);

  return { style, onPressIn, onPressOut, reduceMotion };
};
