import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/common/EmptyState';
import { AppText } from '@/components/ui/AppText';
import { fetchRecentGroupImages } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { ChatMediaView } from './ChatMediaView';
import type { DevreChatMessage } from './chatDomain';

export function GroupMediaScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = typeof params.groupId === 'string' ? params.groupId : '';
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const [messages, setMessages] = useState<DevreChatMessage[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  useEffect(() => { if (groupId) void fetchRecentGroupImages(groupId, 60).then(setMessages).catch(() => undefined); }, [groupId]);
  const images = messages.filter((message) => message.type === 'image');
  const size = (width - spacing.sm * 4) / 3;
  return <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}><View style={{ alignItems: 'center', borderBottomColor: colors.divider, borderBottomWidth: 1, flexDirection: 'row', padding: spacing.sm }}><Pressable accessibilityLabel="Geri dön" onPress={() => router.back()} style={{ padding: spacing.sm }}><Ionicons color={colors.textPrimary} name="arrow-back" size={26} /></Pressable><AppText variant="subtitle" weight="900">Medya</AppText></View>{images.length ? <FlatList contentContainerStyle={{ gap: spacing.sm, padding: spacing.sm }} data={images} keyExtractor={(item) => item.id} numColumns={3} columnWrapperStyle={{ gap: spacing.sm }} renderItem={({ item }) => item.type === 'image' ? <ChatMediaView displayWidth={size} groupId={groupId} height={item.height} mediaPath={item.mediaPath} messageId={item.id} onOpen={setViewer} width={item.width} /> : null} /> : <EmptyState title="Henüz fotoğraf yok" description="Grupta paylaşılan fotoğraflar burada görünür." />}<Modal visible={Boolean(viewer)}><SafeAreaView style={{ backgroundColor: '#000', flex: 1 }}><Pressable onPress={() => setViewer(null)} style={{ padding: spacing.md }}><Ionicons color="#fff" name="close" size={30} /></Pressable>{viewer ? <Image resizeMode="contain" source={{ uri: viewer }} style={{ flex: 1, width: '100%' }} /> : null}</SafeAreaView></Modal></SafeAreaView>;
}
