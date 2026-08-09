import type { PropsWithChildren } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type TextVariant = 'caption' | 'body' | 'subtitle' | 'title' | 'display';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: 'default' | 'muted' | 'danger';
  weight?: TextStyle['fontWeight'];
}

export function AppText({ children, variant = 'body', color = 'default', weight, style, ...props }: PropsWithChildren<AppTextProps>) {
  const { colors, typography } = useTheme();
  const textColor = color === 'muted' ? colors.textMuted : color === 'danger' ? colors.danger : colors.textPrimary;

  return (
    <Text
      {...props}
      style={[
        { color: textColor, fontSize: typography.sizes[variant], lineHeight: typography.lineHeights[variant], fontWeight: weight },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
