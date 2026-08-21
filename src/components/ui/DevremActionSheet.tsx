import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

export interface DevremSheetAction {
  destructive?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

export function DevremActionSheet({ actions, onClose, title, visible }: {
  actions: readonly DevremSheetAction[];
  onClose: () => void;
  title?: string;
  visible: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
    <Pressable accessibilityLabel="Menüyü kapat" onPress={onClose} style={{ backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }}>
      <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, paddingBottom: Math.max(insets.bottom, spacing.md), paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <View style={{ alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, marginBottom: spacing.md, width: 42 }} />
        {title ? <AppText style={{ marginBottom: spacing.sm }} variant="subtitle" weight="900">{title}</AppText> : null}
        {actions.map((action) => <Pressable key={action.label} onPress={() => { onClose(); action.onPress(); }} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56 }}><Ionicons color={action.destructive ? colors.danger : colors.textPrimary} name={action.icon} size={24} /><AppText color={action.destructive ? 'danger' : undefined} weight="700">{action.label}</AppText></Pressable>)}
      </Pressable>
    </Pressable>
  </Modal>;
}
