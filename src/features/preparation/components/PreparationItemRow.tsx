import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { PreparationItem } from '../types/preparation';

const ANIMATION_DURATION = 180;

interface PreparationItemRowProps {
  item: PreparationItem;
  actionsActive: boolean;
  onToggle: (itemId: string) => void;
  onOpenActions: (item: PreparationItem) => void;
  onEdit: (item: PreparationItem) => void;
  onDelete: (item: PreparationItem) => void;
  onCancelActions: () => void;
}

export const PreparationItemRow = memo(function PreparationItemRow({
  item,
  actionsActive,
  onToggle,
  onOpenActions,
  onEdit,
  onDelete,
  onCancelActions,
}: PreparationItemRowProps) {
  const { colors, radii, spacing } = useTheme();
  const [helperExpanded, setHelperExpanded] = useState(false);
  const [completionProgress] = useState(() => new Animated.Value(item.completed ? 1 : 0));
  const [checkboxScale] = useState(() => new Animated.Value(1));
  const [actionsProgress] = useState(() => new Animated.Value(actionsActive ? 1 : 0));
  const previousCompleted = useRef(item.completed);

  useEffect(() => {
    if (previousCompleted.current === item.completed) return;
    previousCompleted.current = item.completed;
    Animated.parallel([
      Animated.timing(completionProgress, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
        toValue: item.completed ? 1 : 0,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(checkboxScale, {
          duration: ANIMATION_DURATION / 2,
          easing: Easing.out(Easing.quad),
          toValue: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(checkboxScale, {
          duration: ANIMATION_DURATION / 2,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [checkboxScale, completionProgress, item.completed]);

  useEffect(() => {
    Animated.timing(actionsProgress, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: actionsActive ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [actionsActive, actionsProgress]);

  const openActions = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onOpenActions(item);
  };
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'activate':
        onToggle(item.id);
        break;
      case 'edit':
        onEdit(item);
        break;
      case 'delete':
        onDelete(item);
        break;
      case 'longpress':
        onOpenActions(item);
        break;
    }
  };
  const accessibilityActions = [
    { name: 'activate', label: item.completed ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle' },
    { name: 'edit', label: 'Görevi düzenle' },
    { name: 'delete', label: 'Görevi sil' },
    { name: 'longpress', label: 'Görev işlemlerini aç' },
  ];

  return (
    <Animated.View style={{
      minHeight: 62,
      transform: [{ scale: actionsProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }],
    }}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary, opacity: actionsProgress }]}
      />
      <Animated.View
        accessibilityElementsHidden={actionsActive}
        importantForAccessibility={actionsActive ? 'no-hide-descendants' : 'auto'}
        pointerEvents={actionsActive ? 'none' : 'auto'}
        style={{
          flexDirection: 'row',
          minHeight: 62,
          opacity: actionsProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        }}
      >
        {item.priority === 'important' ? (
          <View style={{ backgroundColor: colors.primary, borderRadius: 2, marginVertical: spacing.md, width: 3 }} />
        ) : null}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={item.title}
          accessibilityHint="Çift dokunarak tamamlanma durumunu değiştir. Düzenleme ve silme için erişilebilirlik eylemlerini kullan."
          accessibilityState={{ checked: item.completed }}
          accessibilityActions={accessibilityActions}
          hitSlop={4}
          onAccessibilityAction={handleAccessibilityAction}
          onLongPress={openActions}
          onPress={(event) => {
            event.stopPropagation();
            onToggle(item.id);
          }}
          style={{ alignItems: 'center', justifyContent: 'center', minHeight: 52, width: 54 }}
        >
          <Animated.View style={{
            alignItems: 'center',
            backgroundColor: item.completed ? colors.primary : colors.surface,
            borderColor: item.completed ? colors.primary : colors.textMuted,
            borderRadius: radii.sm,
            borderWidth: 2,
            height: 27,
            justifyContent: 'center',
            transform: [{ scale: checkboxScale }],
            width: 27,
          }}>
            <Animated.View style={{
              opacity: completionProgress,
              transform: [{ scale: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
            }}>
              <Ionicons name="checkmark" size={20} color={colors.textInverse} />
            </Animated.View>
          </Animated.View>
        </Pressable>

        <Pressable
          accessible
          accessibilityRole={item.helper ? 'button' : undefined}
          accessibilityLabel={item.helper ? `${item.title}. Yardımcı bilgiyi ${helperExpanded ? 'gizle' : 'göster'}` : item.title}
          accessibilityActions={accessibilityActions.slice(1)}
          onAccessibilityAction={handleAccessibilityAction}
          onLongPress={openActions}
          onPress={(event) => {
            event.stopPropagation();
            onCancelActions();
            if (item.helper) setHelperExpanded((current) => !current);
          }}
          style={({ pressed }) => ({
            flex: 1,
            justifyContent: 'center',
            opacity: pressed ? 0.72 : 1,
            paddingRight: spacing.md,
            paddingVertical: spacing.md,
          })}
        >
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <Animated.View style={{
              flexShrink: 1,
              opacity: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }),
            }}>
              <AppText
                weight={item.priority === 'important' ? '600' : '500'}
                style={item.completed ? { color: colors.textMuted, textDecorationLine: 'line-through' } : undefined}
              >
                {item.title}
              </AppText>
            </Animated.View>
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
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden={!actionsActive}
        pointerEvents={actionsActive ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: 'center',
            flexDirection: 'row',
            opacity: actionsProgress,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        <InlineAction label="Düzenle" onPress={() => onEdit(item)} />
        <AppText color="muted">|</AppText>
        <InlineAction destructive label="Sil" onPress={() => onDelete(item)} />
        <AppText color="muted">|</AppText>
        <InlineAction label="Vazgeç" onPress={onCancelActions} />
      </Animated.View>
    </Animated.View>
  );
});

function InlineAction({ label, destructive = false, onPress }: {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        minHeight: 48,
        opacity: pressed ? 0.58 : 1,
      })}
    >
      <AppText weight="700" style={{ color: destructive ? colors.danger : colors.primary }}>{label}</AppText>
    </Pressable>
  );
}
