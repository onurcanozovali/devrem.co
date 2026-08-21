import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { getLegalDocumentPath, type LegalDocumentId } from './legalDomain';

const documents: { id: LegalDocumentId; title: string; description: string }[] = [
  { id: 'terms', title: 'Kullanıcı Sözleşmesi', description: 'Devrem kullanım koşulları' },
  { id: 'privacy-notice', title: 'KVKK Aydınlatma Metni', description: 'Kişisel verilerin işlenmesine ilişkin bilgilendirme' },
];

export function LegalHubScreen() {
  const { colors, radii, spacing } = useTheme();
  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile dön" hitSlop={12} onPress={() => router.back()} style={{ alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" weight="800">Yasal & Gizlilik</AppText>
          <AppText color="muted" variant="caption">Geçerli metinleri istediğin zaman inceleyebilirsin.</AppText>
        </View>
      </View>
      <View style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' }}>
        {documents.map((document, index) => (
          <Pressable
            key={document.id}
            accessibilityRole="button"
            accessibilityLabel={`${document.title} belgesini aç`}
            onPress={() => router.push(getLegalDocumentPath(document.id) as Href)}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: pressed ? colors.surfaceSecondary : colors.surfaceElevated,
              borderBottomColor: colors.divider,
              borderBottomWidth: index === documents.length - 1 ? 0 : 1,
              flexDirection: 'row',
              gap: spacing.md,
              minHeight: 72,
              padding: spacing.md,
            })}
          >
            <Ionicons name={document.id === 'terms' ? 'document-text-outline' : 'shield-checkmark-outline'} size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText weight="700">{document.title}</AppText>
              <AppText color="muted" variant="caption">{document.description}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}
