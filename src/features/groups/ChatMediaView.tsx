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
  useEffect(() => {
    let active = true;
    void resolveChatMediaLocalUri(groupId, messageId, 'image', mediaPath)
      .then((value) => { if (active) setUri(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [groupId, mediaPath, messageId]);
  const aspectRatio = Math.max(0.6, Math.min(1.8, width / height));
  return (
    <Pressable disabled={!uri || !onOpen} onPress={() => uri && onOpen?.(uri)}>
      <View style={{ alignItems: 'center', aspectRatio, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, justifyContent: 'center', overflow: 'hidden', width: displayWidth }}>
        {uri ? <Image accessibilityLabel="Paylaşılan fotoğraf" resizeMode="cover" source={{ uri }} style={{ height: '100%', width: '100%' }} /> : null}
        {!uri && !failed ? <ActivityIndicator color={colors.primary} /> : null}
        {failed ? <Ionicons color={colors.textMuted} name="image-outline" size={34} /> : null}
      </View>
    </Pressable>
  );
});
