import { Text, type TextProps } from 'react-native';

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

  return (
    <Text
      style={[{ color: theme[color ?? 'text'], fontFamily: Fonts[variant] }, style]}
      {...rest}
    />
  );
}
