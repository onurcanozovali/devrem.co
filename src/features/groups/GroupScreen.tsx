import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getProvinceName } from '@/data/turkeyProvinces';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { PublicProfile } from '@/features/matching/types/discovery';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { militaryTypeLabels, monthLabels } from '@/features/profile/profileOptions';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { acknowledgeDevreGroup, fetchCurrentDevreGroup } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import type { DevreGroupResult } from './types/groups';

function GroupMemberRow({ profile }: { profile: PublicProfile }) {
  const { colors, spacing } = useTheme();
  const photoURL = useProfilePhotoURL(profile.userId, profile.photoPath, profile.updatedAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.firstName} profilini aç`}
      onPress={() => router.push(`/devre/${profile.userId}`)}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: 72,
        paddingVertical: spacing.sm,
      })}
    >
      <Avatar accessibilityLabel={`${profile.firstName} profil fotoğrafı`} imageURL={photoURL} initials={profile.firstName.charAt(0)} size={52} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText weight="800">{profile.firstName}</AppText>
        <AppText color="muted" variant="caption">
          {getProvinceName(profile.residenceCity)} · {`${getProvinceName(profile.departureCity)}'dan yola çıkıyor`}
        </AppText>
      </View>
    </Pressable>
  );
}

export function GroupScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { spacing } = useTheme();
  const [result, setResult] = useState<DevreGroupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const profileIdentityVersion = profile
    ? `${profile.militaryPeriodYear}:${profile.militaryPeriodMonth}:${profile.militaryCity}:${profile.militaryType}:${profile.militaryUnit ?? ''}`
    : '';

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void fetchCurrentDevreGroup(session.userId).then((nextResult) => {
      if (!cancelled) { setResult(nextResult); setError(null); }
    }).catch(() => {
      if (!cancelled) setError('Devre grubun yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
    });
    return () => { cancelled = true; };
  }, [profileIdentityVersion, requestVersion, session]);

  const retry = useCallback(() => {
    setResult(null);
    setError(null);
    setRequestVersion((current) => current + 1);
  }, []);

  if (!profile?.militaryUnit) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Devre grubun henüz oluşmadı" description="Birlik bilgin tamamlandığında grubun otomatik olarak hazırlanacak." /></ScreenContainer>;
  }
  if (error) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Grup yüklenemedi" description={error} actionLabel="Tekrar dene" onAction={retry} /></ScreenContainer>;
  }
  if (!result) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Devre grubun yükleniyor…" /></ScreenContainer>;
  }
  if (result.status === 'pending') {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Devre grubun hazırlanıyor" description="Profilin işlendiğinde grubun otomatik olarak burada görünecek." actionLabel="Tekrar kontrol et" onAction={retry} /></ScreenContainer>;
  }
  const { group } = result;
  const acknowledge = async () => {
    if (!session) return;
    setAcknowledgementError(null);
    try {
      await acknowledgeDevreGroup(session.userId, group.groupId);
      setResult({ ...result, acknowledged: true });
    } catch {
      setAcknowledgementError('Grup bilgisi kaydedilemedi. Tekrar dene.');
    }
  };
  if (!result.acknowledged) {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <Card style={{ gap: spacing.md }}>
          <AppText variant="title" weight="900">Devre grubun hazır.</AppText>
          <AppText color="muted">Aynı birlik ve dönemdeki kişilerle burada konuşabilirsin.</AppText>
          {acknowledgementError ? <AppText color="danger" variant="caption">{acknowledgementError}</AppText> : null}
          <Button label="Grubu Gör" onPress={() => void acknowledge()} />
        </Card>
      </ScreenContainer>
    );
  }
  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
      <View style={{ gap: spacing.xs, paddingTop: spacing.md }}>
        <AppText variant="title" weight="900">Devre Grubum</AppText>
        <AppText color="muted">{group.militaryUnitName ?? 'Birlik'} · {getProvinceName(group.militaryCity)}</AppText>
        <AppText weight="700">{monthLabels[group.militaryPeriodMonth - 1]} {group.militaryPeriodYear} · {militaryTypeLabels[group.militaryType]}</AppText>
      </View>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="subtitle" weight="800">Üyeler · {group.members.length}</AppText>
        {group.members.length <= 1 ? <AppText color="muted">Grubunda şimdilik sadece sen varsın.</AppText> : null}
        {group.members.map((member) => <GroupMemberRow key={member.userId} profile={member} />)}
      </Card>
    </ScreenContainer>
  );
}
