import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getProvinceName } from '@/data/turkeyProvinces';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { mapAuthError } from '@/features/auth/services/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { ProfileEditModal } from './components/ProfileEditModal';
import { AccountDeletionModal } from './components/AccountDeletionModal';
import { useProfile } from './hooks/useProfile';
import { militaryTypeLabels, monthLabels } from './profileOptions';
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
  const { profile, refreshProfile, updateProfile } = useProfile();
  const { colors, radii, spacing } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, paddingTop: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <AppText variant="title" weight="800">Profil</AppText>
          <AppText color="muted">Bilgilerini güncel tut, hazırlığın sana göre şekillensin.</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profili düzenle"
          onPress={() => setIsEditing(true)}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfaceSubtle : colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            minHeight: 44,
            paddingHorizontal: spacing.md,
          })}
        >
          <Ionicons name="pencil" size={17} color={colors.primary} />
          <AppText weight="700" style={{ color: colors.primary }}>Düzenle</AppText>
        </Pressable>
      </View>

      <Card style={{ gap: spacing.lg }}>
        <AppText variant="subtitle" weight="700">Kişisel bilgiler</AppText>
        <ProfileDetail label="Ad Soyad" value={`${profile.firstName} ${profile.lastName}`} />
        <ProfileDetail label="Doğum yılı" value={String(profile.birthYear)} />
        <ProfileDetail label="Yaşadığı şehir" value={getProvinceName(profile.residenceCity)} />
        <ProfileDetail label="Yola çıkacağı şehir" value={getProvinceName(profile.departureCity)} />
      </Card>

      <Card style={{ gap: spacing.lg }}>
        <AppText variant="subtitle" weight="700">Askerlik bilgileri</AppText>
        <ProfileDetail label="Askerlik türü" value={militaryTypeLabels[profile.militaryType]} />
        <ProfileDetail label="Celp yılı" value={String(profile.militaryPeriodYear)} />
        <ProfileDetail
          label="Celp ayı"
          value={monthLabels[profile.militaryPeriodMonth - 1] ?? String(profile.militaryPeriodMonth)}
        />
        <ProfileDetail label="Gideceği şehir" value={getProvinceName(profile.militaryCity)} />
        <ProfileDetail label="Birlik" value={profile.militaryUnit ?? 'Henüz belirtilmedi'} />
        <ProfileDetail label="Teslim tarihi" value={formatStoredDate(profile.reportingDate)} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <AppText variant="subtitle" weight="700">Hesap</AppText>
        <AppText color="muted">Telefon numaran Firebase Authentication tarafından yönetilir ve profil belgesine kopyalanmaz.</AppText>
        {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
        <Button label="Çıkış yap" loading={isLoggingOut} onPress={handleLogout} />
        <View style={{ backgroundColor: colors.border, height: 1, marginVertical: spacing.sm }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hesabı kalıcı olarak sil"
          onPress={() => setIsDeletingAccount(true)}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfaceSubtle : 'transparent',
            borderRadius: radii.sm,
            flexDirection: 'row',
            gap: spacing.sm,
            justifyContent: 'center',
            minHeight: 44,
          })}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <AppText weight="600" style={{ color: colors.danger }}>Hesabı sil</AppText>
        </Pressable>
      </Card>

      {isEditing ? (
        <ProfileEditModal
          profile={profile}
          visible
          onClose={() => setIsEditing(false)}
          onSave={updateProfile}
        />
      ) : null}

      {isDeletingAccount ? (
        <AccountDeletionModal
          visible
          onClose={() => setIsDeletingAccount(false)}
        />
      ) : null}
    </ScreenContainer>
  );
}
