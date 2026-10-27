import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii } from '../theme/tokens';
import { useLanguage } from '../i18n/LanguageContext';
import { Icon } from '../components/ui/Icon';
import { cleanForSpeech, textOfChildren } from './format';
import { getSpeechState, gestureActive, routeTap, stopSpeech, useSpeechSelector } from './store';

/**
 * Double tap to hear.
 *
 *  <Speakable speech={…} onPress={…}> is a drop-in replacement for Pressable:
 *   - single tap → onPress (after a short wait, so a double tap can cancel it)
 *   - double tap → reads `speech` aloud (or, without a script, its visible text cleaned up)
 *   - the innermost speakable under the finger wins; a parent never speaks for its child
 *   - while reading: a highlight ring and a small speaker badge (tap the badge to stop)
 *   - the script is also the accessibility label, so TalkBack / VoiceOver read the same words
 *
 * Every AppText is speakable on its own (see useSpeakableText), so plain text is never silent.
 * A single tap on such text is passed up to the nearest speakable's action (tapping the
 * words on a card still opens the card). Inside an `atomic` speakable (a button), the label
 * text is part of the button and does not speak separately.
 */

export type SpeechSource = string | (() => string) | null | undefined;

interface ScopeValue {
  /** Single-tap action of the nearest speakable ancestor, passed on to plain content inside it. */
  action?: () => void;
  /** Children are part of one control (a button's label and icon); they don't speak on their own. */
  atomic: boolean;
}

const SpeakableScope = createContext<ScopeValue>({ atomic: false });
/** True inside a Text: nested text belongs to its outer text. */
export const TextNesting = createContext(false);

const IDLE = { pressed: false } as PressableStateCallbackType;

const evaluate = (s: SpeechSource) => (typeof s === 'function' ? s() : s) || '';

/** Script → spoken text; without a script, the visible text cleaned up for speech. */
const resolveSpeech = (speech: SpeechSource, fallbackText: () => string, lang: Parameters<typeof cleanForSpeech>[1]) => {
  const authored = evaluate(speech).trim();
  if (authored) return authored;
  return cleanForSpeech(fallbackText(), lang);
};

export interface SpeakableProps extends Omit<PressableProps, 'onPress' | 'children' | 'style'> {
  /** What to say on double tap: a string, or a function evaluated at that moment. */
  speech?: SpeechSource;
  /** Single-tap action. Without one, a single tap goes to the nearest speakable ancestor's action. */
  onPress?: () => void;
  /** Children are part of this control (button label / icon) and don't speak on their own. */
  atomic?: boolean;
  /** Show the speaking ring and badge (default true). */
  indicator?: boolean;
  /** Corner radius of the speaking ring (default: the style's borderRadius). */
  radius?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode);
}

export const Speakable = React.forwardRef<React.ElementRef<typeof View>, SpeakableProps>(function Speakable(
  { speech, onPress, atomic = false, indicator = true, radius, disabled, style, children, accessibilityLabel, ...rest },
  ref,
) {
  const id = useId();
  const { lang } = useLanguage();
  const scope = useContext(SpeakableScope);
  const speaking = useSpeechSelector((s) => s.speakingId === id);
  const active = useSpeechSelector(gestureActive);

  // A disabled control does nothing on a single tap (and does not pass it to its parent), but still speaks
  const action = disabled ? undefined : onPress ?? scope.action;

  // Latest props for the tap handler (the arbiter calls back after a delay)
  const latest = useRef({ speech, action, accessibilityLabel, children, lang });
  useLayoutEffect(() => {
    latest.current = { speech, action, accessibilityLabel, children, lang };
  });

  useEffect(
    () => () => {
      if (getSpeechState().speakingId === id) stopSpeech();
    },
    [id],
  );

  const spokenText = () => {
    const l = latest.current;
    return resolveSpeech(
      l.speech,
      () =>
        l.accessibilityLabel ||
        textOfChildren(typeof l.children === 'function' ? l.children(IDLE) : l.children),
      l.lang,
    );
  };

  const handlePress = () => routeTap({ id, speech: spokenText, action: latest.current.action });

  // Plain content inside passes its single taps to this element's action
  const scopeValue = useMemo<ScopeValue>(() => ({ action, atomic }), [action, atomic]);

  // Inside one control (atomic parent) a passive speakable is just part of it: no touch handling of its own
  if (scope.atomic && !onPress) {
    return (
      <View ref={ref} style={typeof style === 'function' ? style(IDLE) : style}>
        {typeof children === 'function' ? children(IDLE) : children}
      </View>
    );
  }

  const script = evaluate(speech).trim();

  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={handlePress}
      // Gesture off and nothing to do: let the touch fall through to whatever is underneath
      disabled={!active && !action}
      accessibilityLabel={script || accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      style={(state) => {
        const own = typeof style === 'function' ? style(state) : style;
        return [own, active && Platform.OS === 'web' && styles.noSelect] as StyleProp<ViewStyle>;
      }}
    >
      {(state) => (
        <SpeakableScope.Provider value={scopeValue}>
          {typeof children === 'function' ? children(state) : children}
          {speaking && indicator ? (
            <SpeakingRing
              radius={radius ?? (StyleSheet.flatten(typeof style === 'function' ? style(state) : style)?.borderRadius as number | undefined)}
            />
          ) : null}
        </SpeakableScope.Provider>
      )}
    </Pressable>
  );
});

/** Ring around the element being read, with a speaker badge that stops reading when tapped. */
const SpeakingRing: React.FC<{ radius?: number }> = ({ radius = radii.md }) => {
  const { t } = useLanguage();
  return (
    <>
      <View pointerEvents="none" style={[styles.ring, { borderRadius: radius }]} />
      <Pressable
        onPress={stopSpeech}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('stopReading')}
        style={styles.badge}
      >
        <Icon name="listen" size={14} color={colors.onPrimary} active />
      </Pressable>
    </>
  );
};

/**
 * Double tap for an AppText: returns props for its <Text>. Off (no props) when the text is
 * nested in another text, inside a button-like control, or the gesture is switched off; the
 * touch then goes to the parent as before.
 */
export const useSpeakableText = (
  children: React.ReactNode,
  speech: SpeechSource,
  optOut: boolean,
  ownOnPress?: ((...args: never[]) => unknown) | null,
): { speaking: boolean; textProps: { onPress?: () => void; suppressHighlighting?: boolean; selectable?: boolean } } => {
  const id = useId();
  const { lang } = useLanguage();
  const scope = useContext(SpeakableScope);
  const nested = useContext(TextNesting);
  const active = useSpeechSelector(gestureActive);
  const speaking = useSpeechSelector((s) => s.speakingId === id);

  const own = ownOnPress ? () => void (ownOnPress as () => unknown)() : undefined;
  const latest = useRef({ children, speech, lang, action: own ?? scope.action });
  useLayoutEffect(() => {
    latest.current = { children, speech, lang, action: own ?? scope.action };
  });

  useEffect(
    () => () => {
      if (getSpeechState().speakingId === id) stopSpeech();
    },
    [id],
  );

  if (nested || scope.atomic || optOut || !active) return { speaking: false, textProps: {} };

  return {
    speaking,
    textProps: {
      onPress: () =>
        routeTap({
          id,
          speech: () => resolveSpeech(latest.current.speech, () => textOfChildren(latest.current.children), latest.current.lang),
          action: latest.current.action,
        }),
      suppressHighlighting: true,
      // Double-clicking text in a browser would otherwise select a word
      ...(Platform.OS === 'web' ? { selectable: false } : null),
    },
  };
};

/** Highlight for text being read. */
export const speakingTextStyle: TextStyle = {
  backgroundColor: 'rgba(42, 157, 143, 0.16)',
  borderRadius: 4,
};

/** Mark a block as one control: text inside it does not speak on its own. */
export const AtomicSpeakableScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const parent = useContext(SpeakableScope);
  return <SpeakableScope.Provider value={{ action: parent.action, atomic: true }}>{children}</SpeakableScope.Provider>;
};

const styles = StyleSheet.create({
  noSelect: {
    userSelect: 'none',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2.5,
    borderColor: colors.teal,
    backgroundColor: 'rgba(42, 157, 143, 0.08)',
  },
  badge: {
    position: 'absolute',
    top: -9,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    elevation: 6,
  },
});
