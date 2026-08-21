import { DevremActionSheet, type DevremSheetAction } from '@/components/ui/DevremActionSheet';

export type ChatSheetAction = DevremSheetAction;

export function ChatBottomSheet({ actions, onClose, title, visible }: {
  actions: readonly ChatSheetAction[];
  onClose: () => void;
  title?: string;
  visible: boolean;
}) {
  return <DevremActionSheet actions={actions} onClose={onClose} title={title} visible={visible} />;
}
