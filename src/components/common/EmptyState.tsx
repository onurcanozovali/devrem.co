import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
      <AppText variant="subtitle" weight="700">{title}</AppText>
      <AppText color="muted" style={{ textAlign: 'center' }}>{description}</AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ alignSelf: 'stretch', marginTop: spacing.md }} />
      ) : null}
    </View>
  );
}
