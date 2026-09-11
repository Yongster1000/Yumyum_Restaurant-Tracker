import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 2500;
const ANIM_MS = 200;

// Plain (non-hook) helpers so mutating `.value` — the standard Reanimated
// idiom for driving an animation — isn't flagged by the react-compiler lint
// rules as mutating a value straight out of useSharedValue.
function animateIn(opacity: SharedValue<number>, translateY: SharedValue<number>) {
  opacity.value = withTiming(1, { duration: ANIM_MS });
  translateY.value = withTiming(0, { duration: ANIM_MS });
}

function animateOut(opacity: SharedValue<number>, translateY: SharedValue<number>) {
  opacity.value = withTiming(0, { duration: ANIM_MS });
  translateY.value = withTiming(-12, { duration: ANIM_MS });
}

// Minimal, app-wide toast/snackbar. There's no toast library in this
// codebase, so this hand-rolls a small pill anchored below the top safe
// area, fading + sliding in with reanimated and auto-dismissing.
export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (text: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);

      setMessage(text);
      animateIn(opacity, translateY);

      hideTimer.current = setTimeout(() => {
        animateOut(opacity, translateY);
        // Unmount only after the fade-out finishes so the pill doesn't pop
        // away instantly.
        clearTimer.current = setTimeout(() => setMessage(null), ANIM_MS);
      }, VISIBLE_MS);
    },
    [opacity, translateY],
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <Animated.View
          pointerEvents="none"
          style={[styles.container, { top: insets.top + Spacing.space3 }, animatedStyle]}>
          <ThemedText variant="bodySemibold" color="background" style={styles.text}>
            {message}
          </ThemedText>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.space6,
    right: Spacing.space6,
    alignItems: 'center',
    backgroundColor: Colors.text,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.space3,
    paddingHorizontal: Spacing.space4,
    ...Shadows.md,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
});
