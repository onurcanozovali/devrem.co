import { View } from 'react-native';

import { ScreenContainer } from './ScreenContainer';
import { AppText } from '../ui/AppText';
import { Card } from '../ui/Card';
import { useTheme } from '@/theme/ThemeProvider';

interface PlaceholderScreenProps { title: string; description: string }

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  const { spacing } = useTheme();
  return (
    <ScreenContainer scrollable={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" weight="800">{title}</AppText>
          <AppText color="muted">Askere hazırlanmanın tek uygulaması.</AppText>
        </View>
        <Card>
          <AppText variant="subtitle" weight="700">Temel hazır</AppText>
          <AppText color="muted" style={{ marginTop: spacing.sm }}>{description}</AppText>
        </Card>
      </View>
    </ScreenContainer>
  );
}
