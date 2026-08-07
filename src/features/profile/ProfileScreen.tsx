import { useState } from 'react';
import { View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { mapAuthError } from '@/features/auth/services/authErrors';
import { useTheme } from '@/theme/ThemeProvider';

export function ProfileScreen() {
  const { logout } = useAuth();
  const { spacing } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setError(null);
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (caughtError: unknown) {
      setError(mapAuthError(caughtError).message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <ScreenContainer scrollable={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" weight="800">Profil</AppText>
          <AppText color="muted">Hesap ve askerlik bilgileri sonraki fazlarda burada yer alacak.</AppText>
        </View>
        <Card style={{ gap: spacing.md }}>
          <AppText variant="subtitle" weight="700">Oturum</AppText>
          <AppText color="muted">Telefon numaranız Firebase Authentication tarafından güvenli biçimde doğrulandı.</AppText>
          {error ? <AppText color="danger" variant="caption">{error}</AppText> : null}
          <Button label="Çıkış yap" loading={isLoggingOut} onPress={handleLogout} />
        </Card>
      </View>
    </ScreenContainer>
  );
}
