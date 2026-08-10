import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { getProvinceName } from '@/data/turkeyProvinces';
import type { PublicProfile } from '@/features/matching/types/discovery';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { militaryTypeLabels, monthLabels } from '@/features/profile/profileOptions';
import { fetchRecentGroupImages } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { ChatMediaView } from './ChatMediaView';
import type { DevreChatMessage } from './chatDomain';
import { useCurrentDevreGroup } from './useCurrentDevreGroup';

function MemberRow({ profile }: { profile: PublicProfile }) {
  const { colors, spacing } = useTheme();
  const uri = useProfilePhotoURL(profile.userId, profile.photoPath, profile.updatedAt);
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/devre/${profile.userId}`)} style={{ alignItems: 'center', borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68 }}><Avatar accessibilityLabel={`${profile.firstName} profil fotoğrafı`} imageURL={uri} initials={profile.firstName.charAt(0)} size={46} /><View style={{ flex: 1 }}><AppText weight="800">{profile.firstName}</AppText><AppText color="muted" variant="caption">{`${getProvinceName(profile.residenceCity)} · ${getProvinceName(profile.departureCity)}'dan yola çıkıyor`}</AppText></View><Ionicons color={colors.textMuted} name="chevron-forward" size={20} /></Pressable>;
}

export function GroupInfoScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = typeof params.groupId === 'string' ? params.groupId : '';
  const { colors, spacing } = useTheme();
  const { result } = useCurrentDevreGroup();
  const [images, setImages] = useState<DevreChatMessage[]>([]);
  useEffect(() => { if (groupId) void fetchRecentGroupImages(groupId, 4).then(setImages).catch(() => undefined); }, [groupId]);
  if (!result) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Grup bilgisi yükleniyor…" /></ScreenContainer>;
  if (result.status !== 'ready' || result.group.groupId !== groupId) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Grup erişilebilir değil" description="Bu grubun bilgilerini görüntüleyemezsin." /></ScreenContainer>;
  const { group } = result;
  const imageMessages = images.filter((message) => message.type === 'image');
  return <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
    <View style={{ alignItems: 'center', flexDirection: 'row' }}><Pressable accessibilityLabel="Sohbete dön" onPress={() => router.back()} style={{ padding: spacing.sm }}><Ionicons color={colors.textPrimary} name="arrow-back" size={26} /></Pressable><AppText style={{ flex: 1 }} variant="subtitle" weight="900">Grup Bilgisi</AppText></View>
    <View style={{ alignItems: 'center', gap: spacing.sm }}><Avatar accessibilityLabel="Devre grubu" imageURL={null} initials={(group.militaryUnitName ?? 'D').charAt(0)} size={104} /><AppText style={{ textAlign: 'center' }} variant="title" weight="900">{group.militaryUnitName ?? 'Devre Grubu'}</AppText><AppText color="muted">{group.members.length} üye</AppText></View>
    <View style={{ gap: spacing.md }}>{[['Askerlik şehri', getProvinceName(group.militaryCity)], ['Dönem', `${monthLabels[group.militaryPeriodMonth - 1]} ${group.militaryPeriodYear}`], ['Askerlik türü', militaryTypeLabels[group.militaryType]]].map(([label, value]) => <View key={label} style={{ borderBottomColor: colors.divider, borderBottomWidth: 1, gap: spacing.xs, paddingBottom: spacing.md }}><AppText color="muted" variant="caption">{label}</AppText><AppText weight="800">{value}</AppText></View>)}</View>
    {imageMessages.length ? <View style={{ gap: spacing.md }}><View style={{ alignItems: 'center', flexDirection: 'row' }}><AppText style={{ flex: 1 }} variant="subtitle" weight="900">Medya</AppText><Pressable onPress={() => router.push({ pathname: '/group-media/[groupId]', params: { groupId } })}><AppText color="muted" weight="800">Tümünü Gör</AppText></Pressable></View><View style={{ flexDirection: 'row', gap: spacing.sm }}>{imageMessages.map((message) => message.type === 'image' ? <ChatMediaView displayWidth={72} groupId={groupId} height={message.height} key={message.id} mediaPath={message.mediaPath} messageId={message.id} width={message.width} /> : null)}</View></View> : null}
    <View><AppText variant="subtitle" weight="900">Üyeler · {group.members.length}</AppText>{group.members.map((member) => <MemberRow key={member.userId} profile={member} />)}</View>
  </ScreenContainer>;
}
