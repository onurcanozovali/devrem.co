import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { MainTabHeader } from '@/components/common/MainTabHeader';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DevremActionSheet } from '@/components/ui/DevremActionSheet';
import { DevremConfirmModal } from '@/components/ui/DevremConfirmModal';
import { getProvinceName } from '@/data/turkeyProvinces';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { mapAuthError } from '@/features/auth/services/authErrors';
import { ForceAvatar } from '@/features/militaryUnits/ForceAvatar';
import { useTheme } from '@/theme/ThemeProvider';
import { AccountDeletionModal } from './components/AccountDeletionModal';
import { CommunicationPreferenceCard } from './components/CommunicationPreferenceCard';
import { LegalSettingsCard } from './components/LegalSettingsCard';
import { ProfileEditModal } from './components/ProfileEditModal';
import { ThemeSettingsCard } from './components/ThemeSettingsCard';
import { useProfile } from './hooks/useProfile';
import { useProfilePhotoURL } from './hooks/useProfilePhotoURL';
import { militaryTypeLabels, monthLabels } from './profileOptions';
import { mapProfilePhotoError, getProfileInitials } from './services/profilePhotoDomain';
import { prepareProfilePhoto, selectProfilePhoto } from './services/profilePhoto';
import { formatStoredDate } from './services/profileValidation';

type IconName = ComponentProps<typeof Ionicons>['name'];

function Section({ children, title, icon }: { children: ReactNode; title: string; icon: IconName }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        overflow: 'hidden',
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.primarySubtle,
            borderRadius: radii.sm,
            height: 36,
            justifyContent: 'center',
            width: 36,
          }}
        >
          <Ionicons name={icon} size={19} color={colors.primary} />
        </View>
        <AppText variant="subtitle" weight="800">{title}</AppText>
      </View>
      <View style={{ backgroundColor: colors.divider, height: 1 }} />
      <View style={{ paddingHorizontal: spacing.md }}>{children}</View>
    </View>
  );
}

function DetailRow({ icon, label, value, last = false }: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        borderBottomColor: colors.divider,
        borderBottomWidth: last ? 0 : 1,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: 66,
        paddingVertical: spacing.sm,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText color="muted" variant="caption">{label}</AppText>
        <AppText weight="600">{value}</AppText>
      </View>
    </View>
  );
}

function MetaPill({ icon, label }: { icon: IconName; label: string }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.surfaceSecondary,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing.xs,
        minHeight: 32,
        paddingHorizontal: spacing.sm,
      }}
    >
      <Ionicons name={icon} size={14} color={colors.primary} />
      <AppText variant="caption" weight="700">{label}</AppText>
    </View>
  );
}

export function ModernProfileScreen() {
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

  const periodLabel = `${monthLabels[profile.militaryPeriodMonth - 1] ?? profile.militaryPeriodMonth} ${profile.militaryPeriodYear}`;
  const unitLabel = profile.militaryUnitNameSnapshot ?? profile.militaryUnit ?? 'Birlik henüz belirtilmedi';

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
      <MainTabHeader title="Profilim" subtitle="Devrem kimliğin ve tercihlerin" action={<Pressable
          accessibilityRole="button"
          accessibilityLabel="Profili düzenle"
          onPress={() => setIsEditing(true)}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.primarySubtle : colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: radii.pill,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            minHeight: 44,
            paddingHorizontal: spacing.md,
          })}
        >
          <Ionicons name="pencil-outline" size={17} color={colors.primary} />
          <AppText weight="700" style={{ color: colors.primary }}>Düzenle</AppText>
        </Pressable>} />

      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profil fotoğrafı seçeneklerini aç"
          disabled={isPhotoWorking}
          onPress={showPhotoActions}
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1, position: 'relative' })}
        >
          <Avatar
            accessibilityLabel={profile.photoPath ? 'Profil fotoğrafı' : 'Profil baş harfleri'}
            imageURL={localPhotoURL ?? remotePhotoURL}
            initials={getProfileInitials(profile.firstName, profile.lastName)}
            loading={isPhotoWorking}
            size={116}
          />
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.primary,
              borderColor: colors.surfaceElevated,
              borderRadius: radii.pill,
              borderWidth: 3,
              bottom: -8,
              height: 40,
              justifyContent: 'center',
              position: 'absolute',
              right: -8,
              width: 40,
            }}
          >
            <Ionicons name="camera" size={19} color={colors.textInverse} />
          </View>
        </Pressable>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="title" weight="800" style={{ textAlign: 'center' }}>
            {profile.firstName} {profile.lastName}
          </AppText>
          <AppText color="muted">{getProvinceName(profile.residenceCity)} şehrinde yaşıyor</AppText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
          <MetaPill icon="calendar-outline" label={periodLabel} />
          <MetaPill icon="shield-checkmark-outline" label={militaryTypeLabels[profile.militaryType]} />
        </View>
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

      <View
        style={{
          backgroundColor: colors.primarySubtle,
          borderRadius: radii.lg,
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <ForceAvatar forceCode={profile.forceCode} label={unitLabel} size={64} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText weight="800" style={{ color: colors.primary }}>Askerlik özeti</AppText>
            <AppText variant="subtitle" weight="800">{unitLabel}</AppText>
            <AppText color="muted">
              {getProvinceName(profile.militaryCity)} · {periodLabel} · {militaryTypeLabels[profile.militaryType]}
            </AppText>
          </View>
        </View>
        <View style={{ backgroundColor: colors.border, height: 1 }} />
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <Ionicons name="flag-outline" size={17} color={colors.primary} />
          <AppText variant="caption" weight="700">Teslim tarihi: {formatStoredDate(profile.reportingDate)}</AppText>
        </View>
      </View>

      <Section title="Kişisel bilgiler" icon="person-outline">
        <DetailRow icon="calendar-number-outline" label="Doğum yılı" value={String(profile.birthYear)} />
        <DetailRow icon="home-outline" label="Yaşadığı şehir" value={getProvinceName(profile.residenceCity)} />
        <DetailRow icon="navigate-outline" label="Yola çıkacağı şehir" value={getProvinceName(profile.departureCity)} last />
      </Section>

      <Section title="Askerlik bilgileri" icon="ribbon-outline">
        <DetailRow icon="location-outline" label="Askerlik şehri" value={getProvinceName(profile.militaryCity)} />
        <DetailRow icon="business-outline" label="Birlik" value={unitLabel} />
        <DetailRow icon="calendar-outline" label="Celp dönemi" value={periodLabel} />
        <DetailRow icon="shield-checkmark-outline" label="Askerlik türü" value={militaryTypeLabels[profile.militaryType]} last />
      </Section>

      <ThemeSettingsCard />
      <CommunicationPreferenceCard />
      <LegalSettingsCard />

      <View
        style={{
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subtitle" weight="800">Hesap</AppText>
          <AppText color="muted" variant="caption">Oturum ve hesap güvenliği işlemleri</AppText>
        </View>
        {error ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
        <Button label="Çıkış yap" loading={isLoggingOut} onPress={() => setLogoutConfirmOpen(true)} variant="secondary" />
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
      </View>

      {isEditing ? (
        <ProfileEditModal profile={profile} visible onClose={() => setIsEditing(false)} onSave={updateProfile} />
      ) : null}
      {isDeletingAccount ? (
        <AccountDeletionModal visible onClose={() => setIsDeletingAccount(false)} />
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
