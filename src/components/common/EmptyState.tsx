import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '../ui/AppText';

interface EmptyStateProps { title: string; description: string }

export function EmptyState({ title, description }: EmptyStateProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
      <AppText variant="subtitle" weight="700">{title}</AppText>
      <AppText color="muted" style={{ textAlign: 'center' }}>{description}</AppText>
    </View>
  );
}
