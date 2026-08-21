import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DevremConfirmModal } from '@/components/ui/DevremConfirmModal';
import { getProvinceName } from '@/data/turkeyProvinces';
import { getCachedVisibleDirectConversationId, rememberVisibleDirectConversation } from '@/features/directMessages/directConversationCache';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { getMilitaryPeriodLabel, militaryTypeLabels } from '@/features/profile/profileOptions';
import { getOrCreateDirectConversation, fetchPublicProfile, subscribeToDirectBlockState, unblockDirectMessageUser } from '@/services/firebase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { mapDiscoveryError } from './services/discoveryErrors';
import type { PublicProfile } from './types/discovery';
import { getPublicProfileDisplayName } from './services/discoveryDomain';

function PublicProfileContent({ profile }: { profile: PublicProfile }) {
  const { colors, spacing } = useTheme();
  const photoURL = useProfilePhotoURL(profile.userId, profile.photoPath, profile.updatedAt);
  const displayName = getPublicProfileDisplayName(profile);
  const details = [
    ['Yaşadığı şehir', getProvinceName(profile.residenceCity)],
    ['Gideceği şehir', getProvinceName(profile.militaryCity)],
    ['Askerlik dönemi', getMilitaryPeriodLabel(profile.militaryPeriodYear, profile.militaryPeriodMonth)],
    ['Askerlik türü', militaryTypeLabels[profile.militaryType]],
    ['Birlik', profile.militaryUnitName ?? 'Henüz belli değil'],
    ['Yola çıkacağı şehir', getProvinceName(profile.departureCity)],
  ] as const;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Avatar
          accessibilityLabel={profile.photoPath ? `${displayName} profil fotoğrafı` : `${displayName} baş harfi`}
          imageURL={photoURL}
          initials={profile.firstName.charAt(0).toLocaleUpperCase('tr-TR')}
          size={112}
        />
        <AppText variant="title" weight="900">{displayName}</AppText>
      </View>
      <View style={{ gap: spacing.lg }}>
        {details.map(([label, value]) => (
          <View key={label} style={{ borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.xs, paddingBottom: spacing.md }}>
            <AppText color="muted" variant="caption">{label}</AppText>
            <AppText weight="700">{value}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

export function PublicProfileScreen() {
  const { session } = useAuth();
  const { colors, spacing } = useTheme();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [startingMessage, setStartingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [unblocking, setUnblocking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicProfile(userId)
      .then((nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setStatus(nextProfile ? 'ready' : 'missing');
      })
      .catch((caughtError: unknown) => {
        if (cancelled) return;
        setError(mapDiscoveryError(caughtError).message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [requestVersion, userId]);

  useEffect(() => session && userId && session.userId !== userId
    ? subscribeToDirectBlockState(session.userId, userId, setBlocked)
    : undefined, [session, userId]);

  const retry = () => {
    setError(null);
    setStatus('loading');
    setRequestVersion((current) => current + 1);
  };
  const openDirectMessage = async () => {
    if (!profile || !session || startingMessage) return;
    const cachedConversationId = getCachedVisibleDirectConversationId(session.userId, profile.userId);
    if (cachedConversationId) {
      router.push({ pathname: '/direct-chat/[conversationId]', params: { conversationId: cachedConversationId } });
      return;
    }
    setStartingMessage(true);
    setMessageError(null);
    try {
      const conversationId = await getOrCreateDirectConversation(profile.userId);
      rememberVisibleDirectConversation(session.userId, profile.userId, conversationId);
      router.push({ pathname: '/direct-chat/[conversationId]', params: { conversationId } });
    } catch (caughtError: unknown) {
      const code = caughtError instanceof Error ? caughtError.message : '';
      setMessageError(code.includes('direct-messages-disabled')
        ? 'Bu kullanıcı özel mesajları kapatmış.'
        : code.includes('blocked') ? 'Bu kullanıcıyla mesajlaşamazsın.' : 'Özel sohbet açılamadı. Tekrar dene.');
    } finally {
      setStartingMessage(false);
    }
  };
  const unblock = async () => {
    if (!session || unblocking) return;
    setUnblocking(true); setMessageError(null);
    try { await unblockDirectMessageUser(session.userId, userId); setUnblockOpen(false); }
    catch { setMessageError('Engel kaldırılamadı. Tekrar dene.'); }
    finally { setUnblocking(false); }
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.xl }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Devre listesine dön"
          hitSlop={12}
          onPress={() => router.back()}
          style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}
        >
          <Ionicons name="arrow-back" size={25} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="title" weight="800">Devre Profili</AppText>
      </View>
      {status === 'loading' ? <LoadingState label="Devre profili yükleniyor…" /> : null}
      {status === 'ready' && profile ? <><PublicProfileContent profile={profile} />{session?.userId !== profile.userId ? blocked
        ? <Button label="Engeli kaldır" variant="secondary" onPress={() => setUnblockOpen(true)} />
        : <Button label="Mesaj Gönder" loading={startingMessage} onPress={() => void openDirectMessage()} /> : null}{messageError ? <AppText color="danger" variant="caption" accessibilityLiveRegion="polite">{messageError}</AppText> : null}</> : null}
      {status === 'missing' ? (
        <EmptyState title="Profil bulunamadı" description="Bu devre profili artık görüntülenemiyor." />
      ) : null}
      {status === 'error' ? (
        <EmptyState
          title="Profil yüklenemedi"
          description={error ?? 'Lütfen tekrar dene.'}
          actionLabel="Tekrar dene"
          onAction={retry}
        />
      ) : null}
      <DevremConfirmModal confirmLabel="Engeli kaldır" description="Bu kullanıcıyla mevcut özel sohbetin yeniden kullanılabilir olacak." error={messageError} loading={unblocking} onClose={() => setUnblockOpen(false)} onConfirm={() => void unblock()} title="Engeli kaldır?" visible={unblockOpen} />
    </ScreenContainer>
  );
}
