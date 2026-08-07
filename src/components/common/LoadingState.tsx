import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '../ui/AppText';

export function LoadingState({ label = 'Yükleniyor…' }: { label?: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View accessibilityRole="progressbar" style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
      <ActivityIndicator color={colors.primary} />
      <AppText color="muted">{label}</AppText>
    </View>
  );
}
