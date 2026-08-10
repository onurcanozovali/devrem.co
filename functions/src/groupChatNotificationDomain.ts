import { createHash } from 'node:crypto';

export const groupChatMessageMaxLength = 1500;

export interface GroupChatMessageData {
  id: string;
  senderUid: string;
  text: string;
}

export function allowsGroupMessageNotifications(value: unknown): boolean {
  if (!isRecord(value) || value.enabled !== true) return false;
  return value.groupMessagesEnabled === undefined || value.groupMessagesEnabled === true;
}

export function selectGroupMessageRecipients(
  memberUids: readonly string[],
  senderUid: string,
): string[] {
  return [...new Set(memberUids)].filter((uid) => uid.length > 0 && uid !== senderUid);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseGroupChatMessage(messageId: string, value: unknown): GroupChatMessageData | null {
  if (!messageId || !isRecord(value)) return null;
  if (
    value.id !== messageId
    || typeof value.senderUid !== 'string'
    || value.senderUid.trim().length === 0
    || typeof value.text !== 'string'
  ) return null;
  const text = value.text.trim();
  if (!text || text.length > groupChatMessageMaxLength) return null;
  return { id: messageId, senderUid: value.senderUid, text };
}

export function createGroupMessageDeliveryId(
  groupId: string,
  messageId: string,
  recipientUid: string,
): string {
  return createHash('sha256')
    .update(`${groupId}\u0000${messageId}\u0000${recipientUid}`)
    .digest('hex');
}

export function createGroupMessageNotificationCopy(senderName: string, text: string) {
  const normalizedName = senderName.trim() || 'Bir devren';
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  return {
    title: `${normalizedName} • Devre Grubu`,
    body: normalizedText.length > 120 ? `${normalizedText.slice(0, 117)}…` : normalizedText,
  };
}
