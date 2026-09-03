import { StyleSheet, View, type StyleProp, type ViewStyle, type ViewProps } from 'react-native';

import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

export function Card({ style, ...props }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    padding: Spacing.space3,
    ...Shadows.sm,
  },
});
