import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  /** Which loaded font family to render with. Size/weight-by-family, line-height
   * etc. are left to the caller via `style`, same as the design's own inline styles. */
  variant?: 'heading' | 'body' | 'bodyMedium' | 'bodySemibold' | 'bodyBold';
  color?: ThemeColor;
};

export function ThemedText({ style, variant = 'body', color, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = flatStyle?.fontSize ?? 14;

  return (
    <Text
      style={[
        { color: theme[color ?? 'text'], fontFamily: Fonts[variant] },
        // Android derives line height from these custom (Google Fonts) TTFs'
        // own metrics when none is set, which clips ascenders (capital
        // letters, "l"/"h"/"k") — doesn't happen on iOS/web. Give it room
        // unless the caller already specified a line height.
        Platform.OS === 'android' && flatStyle?.lineHeight === undefined && { lineHeight: fontSize * 1.3 },
        style,
      ]}
      {...rest}
    />
  );
}
