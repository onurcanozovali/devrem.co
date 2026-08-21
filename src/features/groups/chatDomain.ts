export const DEVRE_CHAT_MESSAGE_MAX_LENGTH = 1500;
export const DEVRE_CHAT_MESSAGE_PREVIEW_LENGTH = 420;
export const DEVRE_CHAT_AUDIO_MAX_DURATION_MS = 3 * 60 * 1000;
export const DEVRE_CHAT_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

export type DevreChatMessageStatus = 'pending' | 'sent' | 'failed';
export type DevreChatMessageType = 'text' | 'image' | 'audio' | 'document' | 'system';

interface DevreChatMessageBase {
  id: string;
  senderUid: string;
  createdAt: Date | null;
  clientCreatedAt: Date;
  status: DevreChatMessageStatus;
  localMediaUri?: string;
  deletedForEveryone: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  replyToMessageId: string | null;
}

export function getDevreChatMessagePreview(message: DevreChatMessage): string {
  if (message.deletedForEveryone) return 'Bu mesaj silindi';
  if (message.type === 'text') return collapseDevreChatText(message.text) ?? message.text;
  if (message.type === 'image') return message.caption || 'Fotoğraf';
  if (message.type === 'audio') return 'Sesli mesaj';
  if (message.type === 'system') return message.text;
  return message.fileName;
}

export type DevreChatMessage = DevreChatMessageBase & (
  | { type: 'text'; text: string }
  | { type: 'image'; caption: string; mediaPath: string; width: number; height: number }
  | { type: 'audio'; mediaPath: string; durationMillis: number }
  | { type: 'document'; mediaPath: string; fileName: string; mimeType: string; sizeBytes: number; extension: DevreChatDocumentExtension }
  | { type: 'system'; text: string }
);

export const devreChatDocumentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'] as const;
export type DevreChatDocumentExtension = typeof devreChatDocumentExtensions[number];

export const devreChatDocumentMimeTypes: Record<DevreChatDocumentExtension, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export interface NormalizedChatDocument {
  extension: DevreChatDocumentExtension;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uri: string;
}

export function normalizeSelectedChatDocument(asset: {
  mimeType?: string | null;
  name: string;
  size: number;
  uri: string;
}): NormalizedChatDocument {
  const extension = asset.name.split('.').at(-1)?.toLowerCase();
  if (
    !asset.uri
    || !asset.name
    || !extension
    || !devreChatDocumentExtensions.includes(extension as DevreChatDocumentExtension)
  ) throw new Error('unsupported-document');
  const typedExtension = extension as DevreChatDocumentExtension;
  const expectedMime = devreChatDocumentMimeTypes[typedExtension];
  if (asset.mimeType !== expectedMime) throw new Error('unsupported-document');
  if (!Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > DEVRE_CHAT_DOCUMENT_MAX_BYTES) throw new Error('document-too-large');
  return {
    extension: typedExtension,
    fileName: asset.name.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim().slice(0, 120),
    mimeType: expectedMime,
    sizeBytes: asset.size,
    uri: asset.uri,
  };
}

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

export function collapseDevreChatText(value: string): string | null {
  const characters = Array.from(value);
  if (characters.length <= DEVRE_CHAT_MESSAGE_PREVIEW_LENGTH) return null;
  return `${characters.slice(0, DEVRE_CHAT_MESSAGE_PREVIEW_LENGTH).join('').trimEnd()}…`;
}

function messageTime(message: DevreChatMessage): number {
  return (message.createdAt ?? message.clientCreatedAt).getTime();
}

function sameDate(left: Date | null, right: Date | null): boolean {
  return left === right || left?.getTime() === right?.getTime();
}

export function areDevreChatMessagesEqual(left: DevreChatMessage, right: DevreChatMessage): boolean {
  if (
    left.id !== right.id
    || left.type !== right.type
    || left.senderUid !== right.senderUid
    || left.status !== right.status
    || left.localMediaUri !== right.localMediaUri
    || left.deletedForEveryone !== right.deletedForEveryone
    || left.deletedBy !== right.deletedBy
    || left.replyToMessageId !== right.replyToMessageId
    || !sameDate(left.createdAt, right.createdAt)
    || !sameDate(left.clientCreatedAt, right.clientCreatedAt)
    || !sameDate(left.deletedAt, right.deletedAt)
  ) return false;
  if (left.type === 'text' && right.type === 'text') return left.text === right.text;
  if (left.type === 'image' && right.type === 'image') return left.caption === right.caption
    && left.mediaPath === right.mediaPath && left.width === right.width && left.height === right.height;
  if (left.type === 'audio' && right.type === 'audio') return left.mediaPath === right.mediaPath
    && left.durationMillis === right.durationMillis;
  if (left.type === 'document' && right.type === 'document') return left.mediaPath === right.mediaPath
    && left.fileName === right.fileName && left.mimeType === right.mimeType
    && left.sizeBytes === right.sizeBytes && left.extension === right.extension;
  return false;
}

export function mergeDevreChatMessages(
  current: readonly DevreChatMessage[],
  incoming: readonly DevreChatMessage[],
): DevreChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const existing = byId.get(message.id);
    const reconciled = existing?.localMediaUri
      ? { ...message, localMediaUri: existing.localMediaUri }
      : message;
    byId.set(message.id, existing && areDevreChatMessagesEqual(existing, reconciled) ? existing : reconciled);
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
