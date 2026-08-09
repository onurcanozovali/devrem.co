import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { useTheme, useThemeMode } from '@/theme/ThemeProvider';
import { themeModeLabels, type ThemeMode } from '@/theme/themeMode';
import { ThemeSelectionModal } from './ThemeSelectionModal';

export function ThemeSettingsCard() {
  const { colors, radii, spacing } = useTheme();
  const { mode, setMode } = useThemeMode();
  const router = useRouter();
  const [isChoosingTheme, setIsChoosingTheme] = useState(false);

  const selectTheme = (nextMode: ThemeMode) => {
    if (nextMode !== mode) setMode(nextMode);
    setIsChoosingTheme(false);
  };

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <AppText variant="subtitle" weight="700">Ayarlar</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Görünüm: ${themeModeLabels[mode]}`}
          accessibilityHint="Uygulama görünümünü değiştirmek için dokunun"
          onPress={() => setIsChoosingTheme(true)}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated,
            borderRadius: radii.sm,
            flexDirection: 'row',
            gap: spacing.md,
            minHeight: 56,
          })}
        >
          <Ionicons name="contrast-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText weight="700">Görünüm</AppText>
            <AppText color="muted" variant="caption">{themeModeLabels[mode]}</AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
        <View style={{ backgroundColor: colors.divider, height: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bildirim ayarlarını aç"
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated,
            borderRadius: radii.sm,
            flexDirection: 'row',
            gap: spacing.md,
            minHeight: 56,
          })}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText weight="700">Bildirimler</AppText>
            <AppText color="muted" variant="caption">Keşif tercihleri</AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </Card>

      <ThemeSelectionModal
        onClose={() => setIsChoosingTheme(false)}
        onSelect={selectTheme}
        selectedMode={mode}
        visible={isChoosingTheme}
      />
    </>
  );
}