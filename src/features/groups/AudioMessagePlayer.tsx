import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { resolveChatMediaLocalUri } from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { activateChatAudio, clearChatAudio } from './activeAudioPlayer';

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export const AudioMessagePlayer = memo(function AudioMessagePlayer({
  durationMillis, groupId, localUri, mediaPath, messageId, own,
}: {
  durationMillis: number; groupId: string; localUri?: string; mediaPath: string; messageId: string; own: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const [uri, setUri] = useState<string | null>(localUri ?? null);
  useEffect(() => {
    let active = true;
    if (localUri) return () => { active = false; };
    void resolveChatMediaLocalUri(groupId, messageId, 'audio', mediaPath)
      .then((value) => { if (active) setUri(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [groupId, localUri, mediaPath, messageId]);
  const player = useAudioPlayer(uri ? { uri } : null, { updateInterval: 150 });
  const status = useAudioPlayerStatus(player);
  useEffect(() => () => { player.pause(); clearChatAudio(messageId); }, [messageId, player]);
  useEffect(() => {
    if (status.didJustFinish) clearChatAudio(messageId);
  }, [messageId, status.didJustFinish]);
  const total = status.duration || durationMillis / 1000;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  const color = own ? colors.textInverse : colors.primary;
  const toggle = () => {
    if (!uri) return;
    if (status.playing) { player.pause(); clearChatAudio(messageId); }
    else { activateChatAudio(messageId, () => player.pause()); player.play(); }
  };
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 220 }}>
      <Pressable accessibilityLabel={status.playing ? 'Sesli mesajı duraklat' : 'Sesli mesajı oynat'} accessibilityRole="button" onPress={toggle} style={{ alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }}>
        {!uri ? <ActivityIndicator color={color} /> : <Ionicons color={color} name={status.playing ? 'pause' : 'play'} size={25} />}
      </Pressable>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ backgroundColor: own ? 'rgba(255,255,255,0.3)' : colors.border, borderRadius: radii.pill, height: 4, overflow: 'hidden' }}>
          <View style={{ backgroundColor: color, height: 4, width: `${progress * 100}%` }} />
        </View>
        <AppText variant="caption" style={{ color }}>{formatDuration(status.currentTime || durationMillis / 1000)}</AppText>
      </View>
    </View>
  );
});
