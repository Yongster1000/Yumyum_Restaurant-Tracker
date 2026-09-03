import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

type ButtonProps = {
  variant?: 'primary' | 'ghost' | 'icon';
  block?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

// Mirrors the design's `.btn`/`.btn-primary`/`.btn-ghost`/`.btn-icon`/`.btn-block`
// classes: rounded-rectangle (not pill) buttons, labels set in the heading font.
export function Button({ variant = 'primary', block, onPress, disabled, children, textStyle, style }: ButtonProps) {
  const content =
    typeof children === 'string' ? (
      <ThemedText variant="heading" color={variant === 'primary' ? 'background' : 'accent'} style={[styles.label, textStyle]}>
        {children}
      </ThemedText>
    ) : (
      children
    );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: Colors.accent },
        variant === 'ghost' && styles.ghost,
        variant === 'icon' && styles.icon,
        block && styles.block,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    paddingVertical: Spacing.space2,
    paddingHorizontal: Spacing.space3 * 1.2,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.space1,
  },
  icon: {
    width: 36,
    height: 36,
    padding: 0,
  },
  block: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 14,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function CircleButton({
  onPress,
  size = 44,
  backgroundColor = Colors.surface,
  children,
  style,
}: {
  onPress?: () => void;
  size?: number;
  backgroundColor?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={style}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor },
        ]}>
        {children}
      </View>
    </Pressable>
  );
}
