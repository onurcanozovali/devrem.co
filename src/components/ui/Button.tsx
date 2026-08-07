import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  loading?: boolean;
}

export function Button({ label, loading = false, disabled, style, ...props }: ButtonProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      {...props}
      style={(state) => [
        styles.base,
        { backgroundColor: state.pressed ? colors.primaryPressed : colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.lg },
        (disabled || loading) && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
        <AppText color="default" weight="700" style={{ color: colors.onPrimary }}>{label}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  disabled: { opacity: 0.5 },
});
