import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      {...props}
      style={[{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg }, style]}
    >
      {children}
    </View>
  );
}
