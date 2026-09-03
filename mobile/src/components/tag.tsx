import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

type TagVariant = 'accent' | 'accent2' | 'neutral' | 'outline';

const VARIANT_STYLES: Record<TagVariant, { background?: string; color: keyof typeof Colors; border?: string }> = {
  accent: { background: Colors.accent100, color: 'accent800' },
  accent2: { background: Colors.accent2100, color: 'accent2800' },
  neutral: { background: Colors.neutral100, color: 'neutral800' },
  outline: { color: 'accent', border: Colors.accent },
};

export function Tag({
  variant = 'neutral',
  children,
  style,
}: {
  variant?: TagVariant;
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANT_STYLES[variant];
  return (
    <View
      style={[
        styles.base,
        v.background ? { backgroundColor: v.background } : null,
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        style,
      ]}>
      <ThemedText variant="bodyMedium" color={v.color} style={styles.text}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
