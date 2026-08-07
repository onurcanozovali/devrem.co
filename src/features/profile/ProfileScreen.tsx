import { useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getProvinceName } from '@/data/turkeyProvinces';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { mapAuthError } from '@/features/auth/services/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { useProfile } from './hooks/useProfile';
import { getMilitaryPeriodLabel, militaryTypeLabels } from './profileOptions';
import { formatStoredDate } from './services/profileValidation';

function ProfileDetail({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText color="muted" variant="caption">{label}</AppText>
      <AppText weight="600">{value}</AppText>
    </View>
  );
}

export function ProfileScreen() {
  const { logout } = useAuth();
  const { profile, refreshProfile } = useProfile();
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

  if (!profile) {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <EmptyState
          title="Profil bulunamadı"
          description="Profil bilgileri görüntülenemedi. Tekrar yüklemeyi deneyin."
          actionLabel="Tekrar yükle"
          onAction={() => void refreshProfile()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
      <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
        <AppText variant="title" weight="800">Profil</AppText>
        <AppText color="muted">Onboarding sırasında kaydettiğin bilgiler.</AppText>
      </View>

      <Card style={{ gap: spacing.lg }}>
        <AppText variant="subtitle" weight="700">Kişisel bilgiler</AppText>
        <ProfileDetail label="Ad Soyad" value={`${profile.firstName} ${profile.lastName}`} />
        <ProfileDetail label="Yaşadığı şehir" value={getProvinceName(profile.residenceCity)} />
      </Card>

      <Card style={{ gap: spacing.lg }}>
        <AppText variant="subtitle" weight="700">Askerlik bilgileri</AppText>
        <ProfileDetail label="Askerlik türü" value={militaryTypeLabels[profile.militaryType]} />
        <ProfileDetail
          label="Celp dönemi"
          value={getMilitaryPeriodLabel(profile.militaryPeriod.year, profile.militaryPeriod.month)}
        />
        <ProfileDetail label="Gideceği şehir" value={getProvinceName(profile.militaryCity)} />
        <ProfileDetail label="Birlik" value={profile.militaryUnit} />
        <ProfileDetail label="Teslim tarihi" value={formatStoredDate(profile.reportingDate)} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="subtitle" weight="700">Oturum</AppText>
        <AppText color="muted">Telefon numaran Firebase Authentication tarafından yönetilir ve profil belgesine kopyalanmaz.</AppText>
        {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
        <Button label="Çıkış yap" loading={isLoggingOut} onPress={handleLogout} />
      </Card>
    </ScreenContainer>
  );
}
