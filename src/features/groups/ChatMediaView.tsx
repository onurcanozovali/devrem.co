import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { resolveChatMediaLocalUri } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';

export const ChatMediaView = memo(function ChatMediaView({
  groupId,
  displayWidth = 230,
  height,
  mediaPath,
  messageId,
  onOpen,
  width,
}: {
  groupId: string;
  displayWidth?: number;
  height: number;
  mediaPath: string;
  messageId: string;
  onOpen?: (uri: string) => void;
  width: number;
}) {
  const { colors, radii } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    void resolveChatMediaLocalUri(groupId, messageId, 'image', mediaPath)
      .then((value) => { if (active) setUri(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, groupId, mediaPath, messageId]);
  const aspectRatio = Math.max(0.6, Math.min(1.8, width / height));
  return (
    <Pressable disabled={!uri || !onOpen} onPress={() => uri && onOpen?.(uri)}>
      <View style={{ alignItems: 'center', aspectRatio, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, justifyContent: 'center', overflow: 'hidden', width: displayWidth }}>
        {uri ? <Image accessibilityLabel="Paylaşılan fotoğraf" fadeDuration={0} resizeMode="cover" source={{ uri }} style={{ height: '100%', width: '100%' }} /> : null}
        {!uri && !failed ? <ActivityIndicator color={colors.primary} /> : null}
        {failed ? <Pressable accessibilityLabel="Fotoğrafı yeniden yükle" onPress={() => setAttempt((current) => current + 1)} style={{ alignItems: 'center', gap: 4, justifyContent: 'center', minHeight: 48, minWidth: 48 }}><Ionicons color={colors.textMuted} name="reload" size={30} /></Pressable> : null}
      </View>
    </Pressable>
  );
});
