import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { acknowledgeDevreGroup, fetchCurrentDevreGroup } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { GroupChat } from './GroupChat';
import type { DevreGroupResult } from './types/groups';

export function GroupScreen() {
  const { groupId: requestedGroupId } = useLocalSearchParams<{ groupId?: string }>();
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
  if (requestedGroupId && requestedGroupId !== group.groupId) {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <EmptyState
          title="Bu grup artık erişilebilir değil"
          description="Devre bilgin değiştiyse eski grubun mesajları korunur ancak erişimin hemen kapanır."
          actionLabel="Güncel grubumu aç"
          onAction={() => router.replace('/(tabs)/chats')}
        />
      </ScreenContainer>
    );
  }
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
  return session ? <GroupChat key={group.groupId} group={group} userId={session.userId} /> : null;
}
