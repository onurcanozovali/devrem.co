import { router } from 'expo-router';
import { View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';

export function OnboardingScreen() {
  const { colors, radii, spacing } = useTheme();
  return (
    <ScreenContainer scrollable={false}>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: spacing.lg }}>
        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.surfaceSubtle, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <AppText weight="800" style={{ color: colors.primary }}>DEVREM</AppText>
        </View>
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.md }}>
            <AppText variant="display" weight="800">Askere hazırlanmanın tek uygulaması.</AppText>
            <AppText color="muted">Devrem, askerlik hazırlık sürecini daha düzenli ve bağlantılı hale getirmek için geliştiriliyor.</AppText>
          </View>
          <Card><AppText color="muted">Bu ilk sürüm uygulamanın güvenli ve ölçeklenebilir temelini içerir.</AppText></Card>
        </View>
        <Button label="Uygulamayı keşfet" onPress={() => router.replace('/(tabs)')} />
      </View>
    </ScreenContainer>
  );
}
