export const DEVRE_CHAT_MESSAGE_MAX_LENGTH = 1500;

export type DevreChatMessageStatus = 'pending' | 'sent' | 'failed';

export interface DevreChatMessage {
  id: string;
  senderUid: string;
  text: string;
  createdAt: Date | null;
  clientCreatedAt: Date;
  status: DevreChatMessageStatus;
}

export function normalizeDevreChatText(value: string): string {
  return value.trim();
}

export function validateDevreChatText(value: string): string | null {
  const normalized = normalizeDevreChatText(value);

  if (!normalized) {
    return 'Mesaj boş olamaz.';
  }

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
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((left, right) => {
    const timeDifference = messageTime(right) - messageTime(left);
    return timeDifference !== 0 ? timeDifference : right.id.localeCompare(left.id);
  });
}

export function updateDevreChatMessageStatus(
  messages: readonly DevreChatMessage[],
  messageId: string,
  status: DevreChatMessageStatus,
): DevreChatMessage[] {
  return messages.map((message) =>
    message.id === messageId ? { ...message, status } : message,
  );
}
