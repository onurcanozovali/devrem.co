import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getProvinceName } from '@/data/turkeyProvinces';
import { militaryTypeLabels, monthLabels } from '@/features/profile/profileOptions';
import { acknowledgeDevreGroup } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { useCurrentDevreGroup } from './useCurrentDevreGroup';

export function GroupScreen() {
  const { colors, spacing } = useTheme();
  const { error, profile, result, retry, session, setResult } = useCurrentDevreGroup();
  const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);

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
  const openChat = () => router.push({ pathname: '/group-chat/[groupId]', params: { groupId: group.groupId } });
  const acknowledge = async () => {
    if (!session) return;
    setAcknowledgementError(null);
    try {
      await acknowledgeDevreGroup(session.userId, group.groupId);
      setResult({ ...result, acknowledged: true });
      openChat();
    } catch {
      setAcknowledgementError('Grup bilgisi kaydedilemedi. Tekrar dene.');
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
      <View style={{ gap: spacing.xs, paddingTop: spacing.md }}>
        <AppText variant="title" weight="900">Devre Grubum</AppText>
        <AppText color="muted">Canonical Devre grubun ve ortak sohbet alanın.</AppText>
      </View>
      <Card style={{ gap: spacing.lg }}>
          <Pressable accessibilityRole="button" onPress={result.acknowledged ? openChat : () => void acknowledge()} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
            <Avatar accessibilityLabel="Devre grubu" imageURL={null} initials={(group.militaryUnitName ?? 'D').charAt(0)} size={64} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="subtitle" weight="900">{group.militaryUnitName ?? 'Devre Grubu'}</AppText>
              <AppText color="muted">{group.members.length} üye · {getProvinceName(group.militaryCity)}</AppText>
              <AppText variant="caption">{monthLabels[group.militaryPeriodMonth - 1]} {group.militaryPeriodYear} · {militaryTypeLabels[group.militaryType]}</AppText>
            </View>
            <Ionicons color={colors.primary} name="chevron-forward" size={24} />
          </Pressable>
          {acknowledgementError ? <AppText color="danger" variant="caption">{acknowledgementError}</AppText> : null}
          <Button label={result.acknowledged ? 'Sohbeti Aç' : 'Grubu Gör'} onPress={result.acknowledged ? openChat : () => void acknowledge()} />
      </Card>
    </ScreenContainer>
  );
}
