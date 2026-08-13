import { createHash } from 'node:crypto';

export const groupChatMessageMaxLength = 1500;

export interface GroupChatMessageData {
  id: string;
  senderUid: string;
  type: 'audio' | 'document' | 'image' | 'text';
  text: string | null;
  mediaPath: string | null;
  fileName: string | null;
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
  ) return null;
  const type = value.type ?? 'text';
  if (type === 'text' && typeof value.text === 'string') {
    const text = value.text.trim();
    return text && text.length <= groupChatMessageMaxLength
      ? { id: messageId, senderUid: value.senderUid, type, text, mediaPath: null, fileName: null }
      : null;
  }
  if (type === 'image' && typeof value.mediaPath === 'string' && typeof value.caption === 'string') {
    const caption = value.caption.trim();
    if (
      caption.length > groupChatMessageMaxLength
      || !Number.isInteger(value.width)
      || !Number.isInteger(value.height)
      || (value.width as number) <= 0
      || (value.height as number) <= 0
      || (value.width as number) > 1600
      || (value.height as number) > 1600
    ) return null;
    return { id: messageId, senderUid: value.senderUid, type, text: caption || null, mediaPath: value.mediaPath, fileName: null };
  }
  if (type === 'audio' && typeof value.mediaPath === 'string' && typeof value.durationMillis === 'number') {
    if (!Number.isInteger(value.durationMillis) || value.durationMillis <= 0 || value.durationMillis > 180000) return null;
    return { id: messageId, senderUid: value.senderUid, type, text: null, mediaPath: value.mediaPath, fileName: null };
  }
  if (
    type === 'document' && typeof value.mediaPath === 'string' && typeof value.fileName === 'string'
    && typeof value.mimeType === 'string' && typeof value.extension === 'string'
    && typeof value.sizeBytes === 'number'
  ) {
    const allowed = new Map([
      ['pdf', 'application/pdf'], ['doc', 'application/msword'],
      ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['xls', 'application/vnd.ms-excel'],
      ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['ppt', 'application/vnd.ms-powerpoint'],
      ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ]);
    if (
      value.fileName.trim().length === 0 || value.fileName.length > 120
      || allowed.get(value.extension) !== value.mimeType
      || !Number.isInteger(value.sizeBytes) || value.sizeBytes <= 0 || value.sizeBytes > 20 * 1024 * 1024
    ) return null;
    return { id: messageId, senderUid: value.senderUid, type, text: null, mediaPath: value.mediaPath, fileName: value.fileName };
  }
  return null;
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

export function createGroupMessageNotificationCopy(senderName: string, message: GroupChatMessageData) {
  const normalizedName = senderName.trim() || 'Bir devren';
  const normalizedText = message.text?.replace(/\s+/g, ' ').trim() ?? '';
  return {
    title: `${normalizedName} • Devre Grubu`,
    body: message.type === 'audio' ? '🎤 Sesli mesaj'
      : message.type === 'document' ? `📄 ${message.fileName}`
        : message.type === 'image' && !normalizedText ? '📷 Fotoğraf'
        : normalizedText.length > 120 ? `${normalizedText.slice(0, 117)}…` : normalizedText,
  };
}
