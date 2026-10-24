import React, { createContext, useContext, useRef, type ComponentRef, type RefObject } from 'react';
import { View, type ViewProps } from 'react-native';
import { BlurTargetView } from 'expo-blur';

type TargetRef = RefObject<ComponentRef<typeof View> | null>;

const BlurTargetContext = createContext<TargetRef | null>(null);

/** Ref of the content that sibling glass bars (toolbar, tab bar) should blur on Android. */
export const useBlurTarget = () => useContext(BlurTargetContext);

/**
 * Wraps the scrolling content behind the glass toolbar and tab bar.
 * Android (SDK 55+) can only blur views inside a BlurTargetView; iOS and web
 * blur whatever is behind them, so the wrapper is harmless there.
 * Glass bars must be rendered as siblings of this view, never inside it.
 */
export const BlurTargetProvider: React.FC<ViewProps & { overlay: React.ReactNode }> = ({ children, overlay, ...rest }) => {
  const ref = useRef<ComponentRef<typeof View>>(null);
  return (
    <BlurTargetContext.Provider value={ref}>
      <BlurTargetView ref={ref} {...rest}>
        {children}
      </BlurTargetView>
      {overlay}
    </BlurTargetContext.Provider>
  );
};
