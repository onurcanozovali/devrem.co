import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { resolveChatMediaLocalUri } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import type { DevreChatMessage } from './chatDomain';
import { openLocalChatDocument } from './documentOpen';

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export const DocumentMessage = memo(function DocumentMessage({ groupId, message, textColor }: {
  groupId: string;
  message: Extract<DevreChatMessage, { type: 'document' }>;
  textColor: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const [opening, setOpening] = useState(false);
  const open = async () => {
    if (opening) return;
    setOpening(true);
    let uri: string;
    try {
      uri = message.localMediaUri ?? await resolveChatMediaLocalUri(groupId, message.id, 'document', message.mediaPath, message.extension);
    } catch {
      Alert.alert('Belge indirilemedi', 'İnternet bağlantını kontrol edip tekrar dene.');
      setOpening(false);
      return;
    }
    try {
      await openLocalChatDocument(uri, message.mimeType);
    } catch {
      Alert.alert('Belge açılamadı', 'Bu belgeyi açabilecek bir uygulama bulunamadı.');
    } finally { setOpening(false); }
  };
  return <Pressable accessibilityLabel={`${message.fileName} belgesini aç`} onPress={() => void open()} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 235 }}>
    <View style={{ alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, height: 48, justifyContent: 'center', width: 48 }}>{opening ? <ActivityIndicator color={colors.primary} /> : <Ionicons color={colors.primary} name="document-text" size={26} />}</View>
    <View style={{ flex: 1 }}><AppText numberOfLines={2} style={{ color: textColor }} weight="800">{message.fileName}</AppText><AppText variant="caption" style={{ color: textColor, opacity: 0.72 }}>{formatSize(message.sizeBytes)} · {message.extension.toUpperCase()}</AppText></View>
  </Pressable>;
});
