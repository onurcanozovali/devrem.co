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
import { ForceAvatar } from '@/features/militaryUnits/ForceAvatar';
import { getForceDisplayName } from '@/features/militaryUnits/forceBranding';
import type { PublicProfile } from '@/features/matching/types/discovery';
import { useProfilePhotoURL } from '@/features/profile/hooks/useProfilePhotoURL';
import { militaryTypeLabels, monthLabels } from '@/features/profile/profileOptions';
import { fetchRecentGroupDocuments, fetchRecentGroupImages } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { ChatMediaView } from './ChatMediaView';
import { DocumentMessage } from './DocumentMessage';
import type { DevreChatMessage } from './chatDomain';
import { useCurrentDevreGroupById } from './useCurrentDevreGroupById';

function MemberRow({ departed = false, profile }: { departed?: boolean; profile: PublicProfile }) {
  const { colors, spacing } = useTheme();
  const uri = useProfilePhotoURL(profile.userId, profile.photoPath, profile.updatedAt);
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/devre/${profile.userId}`)} style={{ alignItems: 'center', borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, opacity: departed ? 0.7 : 1 }}><Avatar accessibilityLabel={`${profile.firstName} profil fotoğrafı`} imageURL={uri} initials={profile.firstName.charAt(0)} size={46} /><View style={{ flex: 1 }}><AppText weight="800">{profile.firstName}</AppText><AppText color="muted" variant="caption">{departed ? 'Artık bu Devre grubunda değil' : `${getProvinceName(profile.residenceCity)} · ${getProvinceName(profile.departureCity)}'dan yola çıkıyor`}</AppText></View><Ionicons color={colors.textMuted} name="chevron-forward" size={20} /></Pressable>;
}

export function GroupInfoScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = typeof params.groupId === 'string' ? params.groupId : '';
  const { colors, spacing } = useTheme();
  const { error, group, retry } = useCurrentDevreGroupById(groupId);
  const [images, setImages] = useState<DevreChatMessage[]>([]);
  const [documents, setDocuments] = useState<DevreChatMessage[]>([]);
  useEffect(() => { if (groupId) void Promise.all([fetchRecentGroupImages(groupId, 4), fetchRecentGroupDocuments(groupId, 3)]).then(([nextImages, nextDocuments]) => { setImages(nextImages); setDocuments(nextDocuments); }).catch(() => undefined); }, [groupId]);
  if (error) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Grup bilgisi yüklenemedi" description={error} actionLabel="Tekrar dene" onAction={retry} /></ScreenContainer>;
  if (group === undefined) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><LoadingState label="Grup bilgisi yükleniyor…" /></ScreenContainer>;
  if (!group) return <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="Grup erişilebilir değil" description="Bu grubun bilgilerini görüntüleyemezsin." /></ScreenContainer>;
  const imageMessages = images.filter((message) => message.type === 'image');
  return <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
    <View style={{ alignItems: 'center', flexDirection: 'row' }}><Pressable accessibilityLabel="Sohbete dön" onPress={() => router.back()} style={{ padding: spacing.sm }}><Ionicons color={colors.textPrimary} name="arrow-back" size={26} /></Pressable><AppText style={{ flex: 1 }} variant="subtitle" weight="900">Grup Bilgisi</AppText></View>
    <View style={{ alignItems: 'center', gap: spacing.sm }}><ForceAvatar forceCode={group.forceCode} size={104} /><AppText style={{ textAlign: 'center' }} variant="title" weight="900">{group.kind === 'travel' ? 'Yol Arkadaşları' : 'Devre Grubu'}</AppText><AppText color="muted">{group.militaryUnitName ?? 'Birlik bilgisi yok'} · {group.members.length} üye</AppText></View>
    <View style={{ gap: spacing.md }}>{[['Grup türü', group.kind === 'travel' ? 'Aynı şehirden yola çıkan devreler' : 'Aynı canonical Devre'], ['Askerî birlik', group.militaryUnitName ?? 'Belirtilmedi'], ['Kuvvet', getForceDisplayName(group.forceCode)], ['Askerlik şehri', getProvinceName(group.militaryCity)], ...(group.kind === 'travel' && group.departureCity ? [['Yola çıkış şehri', getProvinceName(group.departureCity)]] : []), ['Dönem', `${monthLabels[group.militaryPeriodMonth - 1]} ${group.militaryPeriodYear}`], ['Askerlik türü', militaryTypeLabels[group.militaryType]]].map(([label, value]) => <View key={label} style={{ borderBottomColor: colors.divider, borderBottomWidth: 1, gap: spacing.xs, paddingBottom: spacing.md }}><AppText color="muted" variant="caption">{label}</AppText><AppText weight="800">{value}</AppText></View>)}</View>
    {imageMessages.length || documents.length ? <View style={{ gap: spacing.md }}><View style={{ alignItems: 'center', flexDirection: 'row' }}><AppText style={{ flex: 1 }} variant="subtitle" weight="900">Medya, Bağlantılar ve Belgeler</AppText>{imageMessages.length ? <Pressable onPress={() => router.push({ pathname: '/group-media/[groupId]', params: { groupId } })}><AppText color="muted" weight="800">Tümünü Gör</AppText></Pressable> : null}</View>{imageMessages.length ? <View style={{ flexDirection: 'row', gap: spacing.sm }}>{imageMessages.map((message) => message.type === 'image' ? <ChatMediaView displayWidth={72} groupId={groupId} height={message.height} key={message.id} mediaPath={message.mediaPath} messageId={message.id} width={message.width} /> : null)}</View> : null}{documents.map((message) => message.type === 'document' ? <DocumentMessage groupId={groupId} key={message.id} message={message} textColor={colors.textPrimary} /> : null)}</View> : null}
    <View><AppText variant="subtitle" weight="900">Aktif üyeler · {group.members.length}</AppText>{group.members.map((member) => <MemberRow key={member.userId} profile={member} />)}</View>
    {group.departedMembers.length ? <View><AppText color="muted" variant="subtitle" weight="900">Eski üyeler</AppText>{group.departedMembers.map((member) => <MemberRow departed key={member.userId} profile={member} />)}</View> : null}
  </ScreenContainer>;
}
