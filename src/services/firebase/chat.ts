import {
  Timestamp,
  collection,
  doc,
  documentId,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

import {
  devreChatDocumentExtensions,
  normalizeDevreChatText,
  type DevreChatDocumentExtension,
  type DevreChatMessage,
} from '../../features/groups/chatDomain';
import { countUnreadIncomingMessages } from '../../features/groups/chatRuntime';
import { getFirebaseApp } from './app';
import { getChatMediaPath } from './chatMedia';

const PAGE_SIZE = 40;
export type DevreChatCursor = QueryDocumentSnapshot;
export interface DevreChatPage { messages: DevreChatMessage[]; cursor: DevreChatCursor | null; hasMore: boolean }
export interface DevreGroupReadCursor { uid: string; lastReadMessageId: string; lastReadMessageCreatedAt: Date; lastReadAt: Date }

function messagesCollection(groupId: string) {
  return collection(getFirestore(getFirebaseApp()), 'devreGroups', groupId, 'messages');
}

function parseMessage(snapshot: QueryDocumentSnapshot): DevreChatMessage | null {
  const data = snapshot.data();
  if (data.id !== snapshot.id || typeof data.senderUid !== 'string' || !(data.clientCreatedAt instanceof Timestamp)) return null;
  const base = {
    id: snapshot.id,
    senderUid: data.senderUid,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    clientCreatedAt: data.clientCreatedAt.toDate(),
    status: snapshot.metadata.hasPendingWrites ? 'pending' as const : 'sent' as const,
    deletedForEveryone: data.deletedForEveryone === true,
    deletedAt: data.deletedAt instanceof Timestamp ? data.deletedAt.toDate() : null,
    deletedBy: typeof data.deletedBy === 'string' ? data.deletedBy : null,
    replyToMessageId: typeof data.replyToMessageId === 'string' ? data.replyToMessageId : null,
  };
  const type = data.type ?? 'text';
  if (type === 'text' && typeof data.text === 'string') return { ...base, type, text: data.text };
  if (
    type === 'image' && typeof data.mediaPath === 'string' && typeof data.caption === 'string'
    && typeof data.width === 'number' && typeof data.height === 'number'
  ) return { ...base, type, mediaPath: data.mediaPath, caption: data.caption, width: data.width, height: data.height };
  if (type === 'audio' && typeof data.mediaPath === 'string' && typeof data.durationMillis === 'number') {
    return { ...base, type, mediaPath: data.mediaPath, durationMillis: data.durationMillis };
  }
  if (
    type === 'document' && typeof data.mediaPath === 'string' && typeof data.fileName === 'string'
    && typeof data.mimeType === 'string' && typeof data.sizeBytes === 'number'
    && devreChatDocumentExtensions.includes(data.extension as DevreChatDocumentExtension)
  ) return {
    ...base, type, mediaPath: data.mediaPath, fileName: data.fileName, mimeType: data.mimeType,
    sizeBytes: data.sizeBytes, extension: data.extension as DevreChatDocumentExtension,
  };
  return null;
}

function parsePage(snapshot: QuerySnapshot): DevreChatPage {
  return {
    messages: snapshot.docs.flatMap((item) => { const parsed = parseMessage(item); return parsed ? [parsed] : []; }),
    cursor: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.size === PAGE_SIZE,
  };
}

export function createDevreChatMessageId(groupId: string): string {
  return doc(messagesCollection(groupId)).id;
}

function draftBase(id: string, senderUid: string, replyToMessageId: string | null = null) {
  return {
    id, senderUid, createdAt: null, clientCreatedAt: new Date(), status: 'pending' as const,
    deletedForEveryone: false, deletedAt: null, deletedBy: null, replyToMessageId,
  };
}

export function createDevreChatMessageDraft(groupId: string, senderUid: string, text: string, replyToMessageId: string | null = null): DevreChatMessage {
  return { ...draftBase(createDevreChatMessageId(groupId), senderUid, replyToMessageId), type: 'text', text: normalizeDevreChatText(text) };
}

export function createImageMessageDraft(input: {
  caption: string; groupId: string; height: number; localMediaUri: string; messageId: string; replyToMessageId?: string | null; senderUid: string; width: number;
}): Extract<DevreChatMessage, { type: 'image' }> {
  return {
    ...draftBase(input.messageId, input.senderUid, input.replyToMessageId), type: 'image', caption: normalizeDevreChatText(input.caption),
    mediaPath: getChatMediaPath(input.groupId, input.messageId, 'image'), localMediaUri: input.localMediaUri,
    width: input.width, height: input.height,
  };
}

export function createAudioMessageDraft(input: {
  durationMillis: number; groupId: string; localMediaUri: string; messageId: string; senderUid: string;
}): DevreChatMessage {
  return {
    ...draftBase(input.messageId, input.senderUid), type: 'audio', durationMillis: input.durationMillis,
    mediaPath: getChatMediaPath(input.groupId, input.messageId, 'audio'), localMediaUri: input.localMediaUri,
  };
}

export function createDocumentMessageDraft(input: {
  extension: DevreChatDocumentExtension; fileName: string; groupId: string; localMediaUri: string; replyToMessageId?: string | null;
  messageId: string; mimeType: string; senderUid: string; sizeBytes: number;
}): Extract<DevreChatMessage, { type: 'document' }> {
  return {
    ...draftBase(input.messageId, input.senderUid, input.replyToMessageId), type: 'document', extension: input.extension,
    fileName: input.fileName, mediaPath: getChatMediaPath(input.groupId, input.messageId, 'document'),
    localMediaUri: input.localMediaUri, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
  };
}

export async function sendDevreChatMessage(groupId: string, message: DevreChatMessage): Promise<void> {
  if (message.type === 'system') throw new Error('system-messages-are-server-managed');
  const common = {
    id: message.id, senderUid: message.senderUid, type: message.type,
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.fromDate(message.clientCreatedAt),
    replyToMessageId: message.replyToMessageId, schemaVersion: 4,
  };
  const data = message.type === 'text' ? { ...common, text: message.text }
    : message.type === 'image' ? {
      ...common, mediaPath: message.mediaPath, caption: message.caption, width: message.width, height: message.height,
    } : message.type === 'audio' ? { ...common, mediaPath: message.mediaPath, durationMillis: message.durationMillis }
      : {
        ...common, mediaPath: message.mediaPath, fileName: message.fileName, mimeType: message.mimeType,
        sizeBytes: message.sizeBytes, extension: message.extension,
      };
  await setDoc(doc(messagesCollection(groupId), message.id), data);
}

export function subscribeToRecentDevreChatMessages(groupId: string, onPage: (page: DevreChatPage) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(messagesCollection(groupId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)), (snapshot) => onPage(parsePage(snapshot)), onError);
}

export function subscribeToRecentGroupEvents(groupId: string, onChange: (events: DevreChatMessage[]) => void): () => void {
  return onSnapshot(query(
    collection(getFirestore(getFirebaseApp()), 'devreGroups', groupId, 'groupEvents'),
    orderBy('createdAt', 'desc'), limit(40),
  ), (snapshot) => {
    if (!snapshot) { onChange([]); return; }
    onChange(snapshot.docs.flatMap((item) => {
    const data = item.data();
    if (data.eventId !== item.id || (data.type !== 'membership.joined' && data.type !== 'membership.left')
      || typeof data.displayName !== 'string' || !(data.createdAt instanceof Timestamp)) return [];
    const createdAt = data.createdAt.toDate();
    return [{
      id: `event:${item.id}`,
      senderUid: 'system',
      type: 'system' as const,
      text: data.type === 'membership.left' ? `${data.displayName} gruptan ayrıldı` : `${data.displayName} gruba katıldı`,
      createdAt,
      clientCreatedAt: createdAt,
      status: 'sent' as const,
      deletedForEveryone: false,
      deletedAt: null,
      deletedBy: null,
      replyToMessageId: null,
      }];
    }));
  }, () => onChange([]));
}

export function subscribeToGroupUnreadCount(
  groupId: string,
  uid: string,
  onChange: (count: number) => void,
  onError: (error: Error) => void,
): () => void {
  let messages: DevreChatMessage[] | null = null;
  let cursorLoaded = false;
  let lastReadAt: Date | null = null;
  const emit = () => {
    if (!messages || !cursorLoaded) return;
    onChange(countUnreadIncomingMessages(messages, uid, lastReadAt));
  };
  const unsubscribeMessages = onSnapshot(
    query(messagesCollection(groupId), orderBy('createdAt', 'desc'), limit(100)),
    (snapshot) => { messages = parsePage(snapshot).messages; emit(); },
    onError,
  );
  const unsubscribeCursor = onSnapshot(
    doc(getFirestore(getFirebaseApp()), 'devreGroups', groupId, 'readCursors', uid),
    (snapshot) => {
      const value = snapshot.get('lastReadMessageCreatedAt');
      lastReadAt = value instanceof Timestamp ? value.toDate() : null;
      cursorLoaded = true;
      emit();
    },
    onError,
  );
  return () => { unsubscribeMessages(); unsubscribeCursor(); };
}

export async function fetchOlderDevreChatMessages(groupId: string, cursor: DevreChatCursor): Promise<DevreChatPage> {
  return parsePage(await getDocs(query(messagesCollection(groupId), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE))));
}

export async function fetchRecentGroupImages(groupId: string, count = 24): Promise<DevreChatMessage[]> {
  const snapshot = await getDocs(query(messagesCollection(groupId), where('type', '==', 'image'), orderBy('createdAt', 'desc'), limit(count)));
  return parsePage(snapshot).messages.filter((message) => message.type === 'image' && !message.deletedForEveryone);
}

export async function fetchRecentGroupDocuments(groupId: string, count = 4): Promise<DevreChatMessage[]> {
  const snapshot = await getDocs(query(messagesCollection(groupId), where('type', '==', 'document'), orderBy('createdAt', 'desc'), limit(count)));
  return parsePage(snapshot).messages.filter((message) => message.type === 'document' && !message.deletedForEveryone);
}

export async function hideGroupMessageForUser(uid: string, groupId: string, messageId: string): Promise<void> {
  await setDoc(doc(getFirestore(getFirebaseApp()), 'users', uid, 'hiddenGroupMessages', groupId, 'messages', messageId), {
    groupId, messageId, hiddenAt: serverTimestamp(),
  });
}

export async function fetchHiddenGroupMessageIds(
  uid: string,
  groupId: string,
  messageIds: readonly string[],
): Promise<Set<string>> {
  const result = new Set<string>();
  const hidden = collection(getFirestore(getFirebaseApp()), 'users', uid, 'hiddenGroupMessages', groupId, 'messages');
  for (let index = 0; index < messageIds.length; index += 30) {
    const ids = messageIds.slice(index, index + 30);
    if (!ids.length) continue;
    const snapshot = await getDocs(query(hidden, where(documentId(), 'in', ids)));
    snapshot.docs.forEach((item) => result.add(item.id));
  }
  return result;
}

export async function deleteGroupMessageForEveryone(groupId: string, messageId: string, uid: string): Promise<void> {
  await updateDoc(doc(messagesCollection(groupId), messageId), {
    deletedForEveryone: true,
    deletedAt: serverTimestamp(),
    deletedBy: uid,
  });
}

export function subscribeToGroupReadCursors(
  groupId: string,
  onChange: (cursors: DevreGroupReadCursor[]) => void,
): () => void {
  return onSnapshot(collection(getFirestore(getFirebaseApp()), 'devreGroups', groupId, 'readCursors'), (snapshot) => {
    onChange(snapshot.docs.flatMap((item) => {
      const data = item.data();
      return data.uid === item.id && typeof data.lastReadMessageId === 'string'
        && data.lastReadMessageCreatedAt instanceof Timestamp && data.lastReadAt instanceof Timestamp
        ? [{ uid: item.id, lastReadMessageId: data.lastReadMessageId, lastReadMessageCreatedAt: data.lastReadMessageCreatedAt.toDate(), lastReadAt: data.lastReadAt.toDate() }]
        : [];
    }));
  });
}

export async function markDevreGroupRead(uid: string, groupId: string, message: DevreChatMessage): Promise<void> {
  if (!message.createdAt || message.status !== 'sent') return;
  const database = getFirestore(getFirebaseApp());
  const reference = doc(database, 'devreGroups', groupId, 'readCursors', uid);
  await runTransaction(database, async (transaction) => {
    const current = await transaction.get(reference);
    const currentTime = current.get('lastReadMessageCreatedAt');
    if (currentTime instanceof Timestamp && currentTime.toMillis() >= message.createdAt!.getTime()) return;
    transaction.set(reference, {
      uid,
      lastReadMessageId: message.id,
      lastReadMessageCreatedAt: Timestamp.fromDate(message.createdAt!),
      lastReadAt: serverTimestamp(),
      createdAt: current.exists() && current.get('createdAt') instanceof Timestamp ? current.get('createdAt') : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
