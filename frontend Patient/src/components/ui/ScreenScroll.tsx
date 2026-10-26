import React, { createContext, useContext } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

/** Space taken by the glass toolbar (top) and tab bar (bottom), including safe areas. */
export interface ChromeInsets {
  top: number;
  bottom: number;
}

const ChromeInsetsContext = createContext<ChromeInsets>({ top: 0, bottom: 0 });

export const ChromeInsetsProvider = ChromeInsetsContext.Provider;
/** Space taken by the floating toolbar and tab bar (for screens that lay out their own scrolling). */
export const useChromeInsets = () => useContext(ChromeInsetsContext);

/**
 * Screen-level ScrollView that lets content scroll *under* the glass bars
 * (so the blur has something to show) while keeping it reachable at both ends.
 */
export const ScreenScroll: React.FC<ScrollViewProps> = ({ contentContainerStyle, children, ...rest }) => {
  const { top, bottom } = useContext(ChromeInsetsContext);
  // The screen's own vertical padding is added on top of the bars, not replaced by them
  const own = StyleSheet.flatten(contentContainerStyle) ?? {};
  const ownTop = typeof own.paddingTop === 'number' ? own.paddingTop : 0;
  const ownBottom = typeof own.paddingBottom === 'number' ? own.paddingBottom : 0;
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[own, { paddingTop: top + ownTop, paddingBottom: bottom + ownBottom }]}
      scrollIndicatorInsets={{ top, bottom }}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
