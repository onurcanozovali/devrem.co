import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DevremActionSheet } from '@/components/ui/DevremActionSheet';
import { DevremConfirmModal } from '@/components/ui/DevremConfirmModal';
import { getProvinceName } from '@/data/turkeyProvinces';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { mapAuthError } from '@/features/auth/services/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { ProfileEditModal } from './components/ProfileEditModal';
import { AccountDeletionModal } from './components/AccountDeletionModal';
import { ThemeSettingsCard } from './components/ThemeSettingsCard';
import { CommunicationPreferenceCard } from './components/CommunicationPreferenceCard';
import { LegalSettingsCard } from './components/LegalSettingsCard';
import { useProfile } from './hooks/useProfile';
import { useProfilePhotoURL } from './hooks/useProfilePhotoURL';
import { militaryTypeLabels, monthLabels } from './profileOptions';
import { mapProfilePhotoError, getProfileInitials } from './services/profilePhotoDomain';
import { prepareProfilePhoto, selectProfilePhoto } from './services/profilePhoto';
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
  const { profile, refreshProfile, removeProfilePhoto, replaceProfilePhoto, updateProfile } = useProfile();
  const { colors, radii, spacing } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isPhotoWorking, setIsPhotoWorking] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [localPhotoURL, setLocalPhotoURL] = useState<string | null>(null);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [removePhotoConfirmOpen, setRemovePhotoConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const remotePhotoURL = useProfilePhotoURL(
    profile?.uid ?? '',
    profile?.photoPath ?? null,
    profile?.updatedAt ?? null,
  );

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

  const handleSelectPhoto = async () => {
    if (isPhotoWorking) return;
    setPhotoError(null);
    try {
      const selected = await selectProfilePhoto();
      if (!selected) return;
      setLocalPhotoURL(selected.uri);
      setPhotoProgress(0);
      setIsPhotoWorking(true);
      const preparedURI = await prepareProfilePhoto(selected);
      setLocalPhotoURL(preparedURI);
      await replaceProfilePhoto(preparedURI, setPhotoProgress);
    } catch (caughtError: unknown) {
      setLocalPhotoURL(null);
      setPhotoError(mapProfilePhotoError(caughtError).message);
    } finally {
      setIsPhotoWorking(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (isPhotoWorking) return;
    setPhotoError(null);
    setIsPhotoWorking(true);
    try {
      await removeProfilePhoto();
      setLocalPhotoURL(null);
    } catch (caughtError: unknown) {
      setPhotoError(mapProfilePhotoError(caughtError).message);
    } finally {
      setIsPhotoWorking(false);
    }
  };

  const confirmRemovePhoto = () => {
    setPhotoActionsOpen(false);
    setRemovePhotoConfirmOpen(true);
  };

  const showPhotoActions = () => {
    if (isPhotoWorking) return;
    setPhotoActionsOpen(true);
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
            backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated,
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

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profil fotoğrafı seçeneklerini aç"
          disabled={isPhotoWorking}
          onPress={showPhotoActions}
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Avatar
            accessibilityLabel={profile.photoPath ? 'Profil fotoğrafı' : 'Profil fotoğrafı yerine ad ve soyad baş harfleri'}
            imageURL={localPhotoURL ?? remotePhotoURL}
            initials={getProfileInitials(profile.firstName, profile.lastName)}
            loading={isPhotoWorking}
          />
        </Pressable>
        <AppText variant="subtitle" weight="800">{profile.firstName} {profile.lastName}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profil fotoğrafını değiştir"
          accessibilityState={{ busy: isPhotoWorking, disabled: isPhotoWorking }}
          disabled={isPhotoWorking}
          onPress={showPhotoActions}
          style={{ justifyContent: 'center', minHeight: 44 }}
        >
          <AppText weight="700" style={{ color: colors.primary }}>Profil fotoğrafını değiştir</AppText>
        </Pressable>
        {isPhotoWorking ? (
          <AppText color="muted" variant="caption" accessibilityLiveRegion="polite">
            {photoProgress > 0 ? `Fotoğraf yükleniyor · %${Math.round(photoProgress * 100)}` : 'Fotoğraf hazırlanıyor'}
          </AppText>
        ) : null}
        {photoError ? (
          <AppText color="danger" variant="caption" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
            {photoError}
          </AppText>
        ) : null}
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
        <ProfileDetail label="Birlik" value={profile.militaryUnitNameSnapshot ?? profile.militaryUnit ?? 'Henüz belirtilmedi'} />
        <ProfileDetail label="Teslim tarihi" value={formatStoredDate(profile.reportingDate)} />
      </Card>

      <ThemeSettingsCard />
      <CommunicationPreferenceCard />
      <LegalSettingsCard />

      <Card style={{ gap: spacing.md }}>
        <AppText variant="subtitle" weight="700">Hesap</AppText>
        <AppText color="muted">Telefon numaran Firebase Authentication tarafından yönetilir ve profil belgesine kopyalanmaz.</AppText>
        {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
        <Button label="Çıkış yap" loading={isLoggingOut} onPress={() => setLogoutConfirmOpen(true)} />
        <View style={{ backgroundColor: colors.divider, height: 1, marginVertical: spacing.sm }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hesabı kalıcı olarak sil"
          onPress={() => setIsDeletingAccount(true)}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
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

      <DevremActionSheet
        actions={[
          { icon: 'image-outline', label: 'Fotoğraf seç', onPress: () => void handleSelectPhoto() },
          ...(profile.photoPath !== null ? [{ destructive: true, icon: 'trash-outline' as const, label: 'Fotoğrafı kaldır', onPress: confirmRemovePhoto }] : []),
        ]}
        onClose={() => setPhotoActionsOpen(false)}
        title="Profil fotoğrafı"
        visible={photoActionsOpen}
      />
      <DevremConfirmModal
        confirmLabel="Fotoğrafı kaldır"
        description="Profil fotoğrafın kaldırılacak. Daha sonra yeniden ekleyebilirsin."
        destructive
        loading={isPhotoWorking}
        onClose={() => setRemovePhotoConfirmOpen(false)}
        onConfirm={() => void handleRemovePhoto().then(() => setRemovePhotoConfirmOpen(false))}
        title="Profil fotoğrafını kaldır"
        visible={removePhotoConfirmOpen}
      />
      <DevremConfirmModal
        confirmLabel="Çıkış yap"
        description="Devrem hesabındaki açık oturum bu cihazda kapatılacak."
        error={error}
        loading={isLoggingOut}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={() => void handleLogout()}
        title="Çıkış yapılsın mı?"
        visible={logoutConfirmOpen}
      />

    </ScreenContainer>
  );
}
