export const DEVRE_CHAT_MESSAGE_MAX_LENGTH = 1500;
export const DEVRE_CHAT_AUDIO_MAX_DURATION_MS = 3 * 60 * 1000;

export type DevreChatMessageStatus = 'pending' | 'sent' | 'failed';
export type DevreChatMessageType = 'text' | 'image' | 'audio';

interface DevreChatMessageBase {
  id: string;
  senderUid: string;
  createdAt: Date | null;
  clientCreatedAt: Date;
  status: DevreChatMessageStatus;
  localMediaUri?: string;
}

export type DevreChatMessage = DevreChatMessageBase & (
  | { type: 'text'; text: string }
  | { type: 'image'; caption: string; mediaPath: string; width: number; height: number }
  | { type: 'audio'; mediaPath: string; durationMillis: number }
);

export function normalizeDevreChatText(value: string): string {
  return value.trim();
}

export function validateDevreChatText(value: string): string | null {
  const normalized = normalizeDevreChatText(value);
  if (!normalized) return 'Mesaj boş olamaz.';
  if (normalized.length > DEVRE_CHAT_MESSAGE_MAX_LENGTH) {
    return `Mesaj en fazla ${DEVRE_CHAT_MESSAGE_MAX_LENGTH} karakter olabilir.`;
  }
  return null;
}

function messageTime(message: DevreChatMessage): number {
  return (message.createdAt ?? message.clientCreatedAt).getTime();
}

export function mergeDevreChatMessages(
  current: readonly DevreChatMessage[],
  incoming: readonly DevreChatMessage[],
): DevreChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const existing = byId.get(message.id);
    byId.set(message.id, existing?.localMediaUri
      ? { ...message, localMediaUri: existing.localMediaUri }
      : message);
  }
  return [...byId.values()].sort((left, right) => {
    const difference = messageTime(right) - messageTime(left);
    return difference !== 0 ? difference : right.id.localeCompare(left.id);
  });
}

export function updateDevreChatMessageStatus(
  messages: readonly DevreChatMessage[],
  messageId: string,
  status: DevreChatMessageStatus,
): DevreChatMessage[] {
  return messages.map((message) => message.id === messageId ? { ...message, status } : message);
}

export function isSameMessageCluster(
  newer: DevreChatMessage | undefined,
  current: DevreChatMessage,
): boolean {
  if (!newer || newer.senderUid !== current.senderUid) return false;
  return Math.abs(messageTime(newer) - messageTime(current)) <= 5 * 60 * 1000;
}

export function formatChatDate(date: Date, now = new Date()): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const difference = Math.round((today - day) / 86_400_000);
  if (difference === 0) return 'Bugün';
  if (difference === 1) return 'Dün';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function shouldShowDateSeparator(
  older: DevreChatMessage | undefined,
  current: DevreChatMessage,
): boolean {
  if (!older) return true;
  const left = older.createdAt ?? older.clientCreatedAt;
  const right = current.createdAt ?? current.clientCreatedAt;
  return left.toDateString() !== right.toDateString();
}
