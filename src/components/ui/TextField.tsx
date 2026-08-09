import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  prefix?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, prefix, style, ...props },
  ref,
) {
  const { colors, radii, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText weight="600">{label}</AppText>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.inputBackground,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radii.md,
          borderWidth: 1,
          flexDirection: 'row',
          minHeight: 54,
          paddingHorizontal: spacing.md,
        }}
      >
        {prefix ? <AppText weight="700" style={{ marginRight: spacing.sm }}>{prefix}</AppText> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          {...props}
          style={[
            { color: colors.textPrimary, flex: 1, fontSize: typography.sizes.body, paddingVertical: spacing.md },
            style,
          ]}
        />
      </View>
      {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
    </View>
  );
});
