import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ label, loading = false, variant = 'primary', disabled, style, ...props }: ButtonProps) {
  const { colors, radii, spacing } = useTheme();
  const labelColor = variant === 'secondary' ? colors.primary : colors.textInverse;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      {...props}
      style={(state) => [
        styles.base,
        {
          backgroundColor: variant === 'secondary'
            ? state.pressed ? colors.surfaceSecondary : colors.surfaceElevated
            : variant === 'danger'
              ? colors.danger
              : state.pressed ? colors.primaryPressed : colors.primary,
          borderColor: variant === 'secondary' ? colors.border : 'transparent',
          borderRadius: radii.md,
          borderWidth: 1,
          paddingHorizontal: spacing.lg,
        },
        (disabled || loading) && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? <ActivityIndicator color={labelColor} /> : (
        <AppText color="default" weight="700" style={{ color: labelColor }}>{label}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  disabled: { opacity: 0.5 },
});
