import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { GroupChat } from './GroupChat';
import { useCurrentDevreGroupById } from './useCurrentDevreGroupById';
import { parseGroupChatReturnPath } from './groupChatNavigation';

export function GroupChatRouteScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[]; returnTo?: string | string[]; source?: string | string[] }>();
  const groupId = typeof params.groupId === 'string' ? params.groupId : '';
  const returnTo = parseGroupChatReturnPath(params.returnTo);
  const { error, group, retry, session } = useCurrentDevreGroupById(groupId);
  const leaveChat = useCallback(() => {
    if (returnTo) router.replace(returnTo);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/chats');
  }, [returnTo]);
  useEffect(() => {
    if (!returnTo) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { leaveChat(); return true; });
    return () => subscription.remove();
  }, [leaveChat, returnTo]);
  if (error) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Sohbet açılamadı" description={error} actionLabel="Tekrar dene" onAction={retry} /></ScreenContainer>;
  if (group === undefined) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Sohbet açılıyor…" /></ScreenContainer>;
  if (!group || !session) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Bu gruba artık erişimin yok" description="Yalnızca güncel Devre ve Yol Arkadaşları gruplarının sohbetini açabilirsin." actionLabel="Güncel sohbetlere dön" onAction={leaveChat} /></ScreenContainer>;
  }
  return <GroupChat group={group} onBack={leaveChat} userId={session.userId} />;
}
