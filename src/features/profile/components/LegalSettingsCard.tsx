import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export function LegalSettingsCard() {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Yasal ve Gizlilik belgelerini aç"
      onPress={() => router.push('/legal' as Href)}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: 72,
        padding: spacing.md,
      })}
    >
      <View style={{ alignItems: 'center', backgroundColor: colors.primarySubtle, borderRadius: radii.sm, height: 40, justifyContent: 'center', width: 40 }}>
        <Ionicons name="shield-checkmark-outline" size={21} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="800">Yasal & Gizlilik</AppText>
        <AppText color="muted" variant="caption">Kullanıcı Sözleşmesi ve KVKK Aydınlatma Metni</AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}
