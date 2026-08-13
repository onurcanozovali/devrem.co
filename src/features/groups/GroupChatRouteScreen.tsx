import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { GroupChat } from './GroupChat';
import { useCurrentDevreGroup } from './useCurrentDevreGroup';
import { parseGroupChatReturnPath } from './groupChatNavigation';

export function GroupChatRouteScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[]; returnTo?: string | string[]; source?: string | string[] }>();
  const groupId = typeof params.groupId === 'string' ? params.groupId : '';
  const returnTo = parseGroupChatReturnPath(params.returnTo);
  const { error, result, retry, session } = useCurrentDevreGroup();
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
  if (!result) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Sohbet açılıyor…" /></ScreenContainer>;
  if (result.status !== 'ready' || result.group.groupId !== groupId || !session) {
    return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Bu grup erişilebilir değil" description="Yalnızca güncel canonical Devre grubunun sohbetini açabilirsin." /></ScreenContainer>;
  }
  return <GroupChat group={result.group} onBack={leaveChat} userId={session.userId} />;
}
