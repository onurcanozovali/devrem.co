import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { PreparationItem } from '../types/preparation';

interface PreparationItemRowProps {
  item: PreparationItem;
  pending: boolean;
  onToggle: () => void;
  onOpenActions: () => void;
}

export function PreparationItemRow({ item, pending, onToggle, onOpenActions }: PreparationItemRowProps) {
  const { colors, radii, spacing } = useTheme();
  const [helperExpanded, setHelperExpanded] = useState(false);

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate') onToggle();
    if (event.nativeEvent.actionName === 'longpress') onOpenActions();
  };

  return (
    <View style={{ flexDirection: 'row', minHeight: 62 }}>
      {item.priority === 'important' ? (
        <View style={{ backgroundColor: colors.primary, borderRadius: 2, marginVertical: spacing.md, width: 3 }} />
      ) : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={item.title}
        accessibilityHint="Çift dokunarak tamamlanma durumunu değiştir. Görev işlemleri için erişilebilirlik eylemlerini kullan."
        accessibilityState={{ checked: item.completed, disabled: pending }}
        accessibilityActions={[
          { name: 'activate', label: item.completed ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle' },
          { name: 'longpress', label: 'Görev işlemlerini aç' },
        ]}
        disabled={pending}
        hitSlop={4}
        onAccessibilityAction={handleAccessibilityAction}
        onLongPress={onOpenActions}
        onPress={onToggle}
        style={{ alignItems: 'center', justifyContent: 'center', minHeight: 52, width: 54 }}
      >
        <View style={{
          alignItems: 'center',
          backgroundColor: item.completed ? colors.primary : colors.surface,
          borderColor: item.completed ? colors.primary : colors.textMuted,
          borderRadius: radii.sm,
          borderWidth: 2,
          height: 27,
          justifyContent: 'center',
          opacity: pending ? 0.55 : 1,
          width: 27,
        }}>
          {item.completed ? <Ionicons name="checkmark" size={20} color={colors.onPrimary} /> : null}
        </View>
      </Pressable>

      <Pressable
        accessible
        accessibilityRole={item.helper ? 'button' : undefined}
        accessibilityLabel={item.helper ? `${item.title}. Yardımcı bilgiyi ${helperExpanded ? 'gizle' : 'göster'}` : item.title}
        accessibilityActions={!item.helper ? [{ name: 'longpress', label: 'Görev işlemlerini aç' }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') onOpenActions();
        }}
        onLongPress={onOpenActions}
        onPress={item.helper ? () => setHelperExpanded((current) => !current) : undefined}
        style={({ pressed }) => ({
          flex: 1,
          justifyContent: 'center',
          opacity: pressed ? 0.72 : 1,
          paddingRight: spacing.md,
          paddingVertical: spacing.md,
        })}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <AppText
            weight={item.priority === 'important' ? '600' : '500'}
            style={[styles.title, item.completed && { color: colors.textMuted, textDecorationLine: 'line-through' }]}
          >
            {item.title}
          </AppText>
          {item.helper ? (
            <Ionicons
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              name={helperExpanded ? 'chevron-up-circle-outline' : 'information-circle-outline'}
              size={19}
              color={colors.textMuted}
            />
          ) : null}
        </View>
        {item.priority === 'important' && !item.completed ? (
          <AppText color="muted" variant="caption" style={{ marginTop: spacing.xs }}>Önemli</AppText>
        ) : null}
        {item.helper && helperExpanded ? (
          <AppText color="muted" variant="caption" style={{ marginTop: spacing.sm }}>{item.helper}</AppText>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { flexShrink: 1 },
});
