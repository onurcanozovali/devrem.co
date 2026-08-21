import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { LEGAL_DOCUMENTS } from './legalContent';
import type { LegalDocumentId } from './legalDomain';

export function LegalDocumentScreen({ documentId }: { documentId: LegalDocumentId }) {
  const { colors, radii, spacing } = useTheme();
  const document = LEGAL_DOCUMENTS[documentId];

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
            borderRadius: radii.pill,
            height: 44,
            justifyContent: 'center',
            width: 44,
          })}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" weight="800" numberOfLines={2}>{document.title}</AppText>
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.primarySubtle,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <AppText variant="caption" weight="700" style={{ color: colors.primary }}>
          Sürüm {document.version}
        </AppText>
      </View>

      {document.sections.map((section) => (
        <View key={section.title} style={{ gap: spacing.sm }}>
          <AppText variant="subtitle" weight="800">{section.title}</AppText>
          {section.paragraphs?.map((paragraph) => (
            <AppText key={paragraph} style={{ color: colors.textSecondary }}>{paragraph}</AppText>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm }}>
              <AppText style={{ color: colors.primary }}>•</AppText>
              <AppText style={{ color: colors.textSecondary, flex: 1 }}>{bullet}</AppText>
            </View>
          ))}
        </View>
      ))}
    </ScreenContainer>
  );
}
