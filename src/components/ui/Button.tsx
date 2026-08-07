import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
}

export function Button({ label, disabled, style, ...props }: ButtonProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      {...props}
      style={(state) => [
        styles.base,
        { backgroundColor: state.pressed ? colors.primaryPressed : colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.lg },
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <AppText color="default" weight="700" style={{ color: colors.onPrimary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  disabled: { opacity: 0.5 },
});
