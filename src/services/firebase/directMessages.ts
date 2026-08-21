import { getAuth, getIdToken } from '@react-native-firebase/auth';
import {
  Timestamp, addDoc, collection, collectionGroup, deleteDoc, doc, documentId, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, startAfter, updateDoc, where, writeBatch, type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';

import { getAppConfig } from '@/config/env';
import { devreChatDocumentExtensions, normalizeDevreChatText, type DevreChatDocumentExtension, type DevreChatMessage } from '@/features/groups/chatDomain';
import { getFirebaseApp } from './app';
import { getDirectChatMediaPath, uploadDirectChatMedia } from './chatMedia';

export interface DirectConversation {
  conversationId: string;
  participantUids: [string, string];
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  lastSenderUid: string | null;
  lastMessageType: 'text' | 'image' | 'document' | null;
}

export interface DirectParticipantState {
  hidden: boolean;
  messagingAllowed: boolean;
  unreadCount: number;
}

export type DirectMessage = Exclude<DevreChatMessage, { type: 'audio' | 'system' }>;

function endpoint() {
  return `https://europe-west1-${getAppConfig().firebase.projectId}.cloudfunctions.net/getOrCreateDirectConversationEndpoint`;
}

export async function getOrCreateDirectConversation(recipientUid: string): Promise<string> {
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) throw new Error('unauthenticated');
  const response = await fetch(endpoint(), { method: 'POST', headers: { Authorization: `Bearer ${await getIdToken(user)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientUid }) });
  const value = await response.json() as { code?: string; conversationId?: string };
  if (!response.ok || typeof value.conversationId !== 'string') throw new Error(value.code ?? 'direct-conversation-failed');
  return value.conversationId;
}

function parseConversation(id: string, value: Record<string, unknown>): DirectConversation | null {
  const participantUids = value.participantUids;
  if (value.conversationId !== id || !Array.isArray(participantUids) || participantUids.length !== 2 || !participantUids.every((uid) => typeof uid === 'string')) return null;
  const type = value.lastMessageType;
  return {
    conversationId: id,
    participantUids: participantUids as [string, string],
    lastMessagePreview: typeof value.lastMessagePreview === 'string' ? value.lastMessagePreview : null,
    lastMessageAt: value.lastMessageAt instanceof Timestamp ? value.lastMessageAt.toDate() : null,
    lastSenderUid: typeof value.lastSenderUid === 'string' ? value.lastSenderUid : null,
    lastMessageType: type === 'text' || type === 'image' || type === 'document' ? type : null,
  };
}

export function subscribeToDirectConversations(
  uid: string,
  listener: (items: DirectConversation[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(query(
    collection(getFirestore(getFirebaseApp()), 'directConversations'),
    where('participantUids', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc'),
    limit(100),
  ), (snapshot) => {
    // React Native Firebase can briefly deliver a null snapshot while a listener is
    // being re-attached. That is not an authoritative empty query result, so keep
    // the last valid inbox until a real snapshot arrives.
    if (!snapshot) return;
    listener(snapshot.docs.flatMap((item) => { const parsed = parseConversation(item.id, item.data()); return parsed ? [parsed] : []; })
      .sort((left, right) => (right.lastMessageAt?.getTime() ?? 0) - (left.lastMessageAt?.getTime() ?? 0)));
  }, (error) => onError?.(error));
}

export function subscribeToDirectParticipantStates(
  uid: string,
  listener: (states: ReadonlyMap<string, DirectParticipantState>) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(query(
    collectionGroup(getFirestore(getFirebaseApp()), 'participantStates'),
    where('uid', '==', uid),
  ), (snapshot) => {
    const states = new Map<string, DirectParticipantState>();
    for (const item of snapshot?.docs ?? []) {
      const conversationId = item.ref.parent.parent?.id;
      if (!conversationId) continue;
      states.set(conversationId, {
        hidden: item.get('hidden') === true,
        messagingAllowed: item.get('messagingAllowed') !== false,
        unreadCount: Math.max(0, Number(item.get('unreadCount')) || 0),
      });
    }
    listener(states);
  }, (error) => onError?.(error));
}

export async function fetchDirectConversation(conversationId: string): Promise<DirectConversation | null> {
  const snapshot = await getDoc(doc(getFirestore(getFirebaseApp()), 'directConversations', conversationId));
  return snapshot.exists() ? parseConversation(snapshot.id, snapshot.data()) : null;
}

function parseMessage(snapshot: QueryDocumentSnapshot): DirectMessage | null {
  const data = snapshot.data();
  if (data.id !== snapshot.id || typeof data.senderUid !== 'string' || !(data.clientCreatedAt instanceof Timestamp)) return null;
  const base = { id: snapshot.id, senderUid: data.senderUid, createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    clientCreatedAt: data.clientCreatedAt.toDate(), status: snapshot.metadata.hasPendingWrites ? 'pending' as const : 'sent' as const,
    deletedForEveryone: data.deletedForEveryone === true, deletedAt: data.deletedAt instanceof Timestamp ? data.deletedAt.toDate() : null,
    deletedBy: typeof data.deletedBy === 'string' ? data.deletedBy : null, replyToMessageId: typeof data.replyToMessageId === 'string' ? data.replyToMessageId : null };
  if (data.type === 'text' && typeof data.text === 'string') return { ...base, type: 'text', text: data.text };
  if (data.type === 'image' && typeof data.mediaPath === 'string' && typeof data.caption === 'string' && typeof data.width === 'number' && typeof data.height === 'number') {
    return { ...base, type: 'image', mediaPath: data.mediaPath, caption: data.caption, width: data.width, height: data.height };
  }
  if (data.type === 'document' && typeof data.mediaPath === 'string' && typeof data.fileName === 'string' && typeof data.mimeType === 'string'
    && typeof data.sizeBytes === 'number' && devreChatDocumentExtensions.includes(data.extension as DevreChatDocumentExtension)) {
    return { ...base, type: 'document', mediaPath: data.mediaPath, fileName: data.fileName, mimeType: data.mimeType,
      sizeBytes: data.sizeBytes, extension: data.extension as DevreChatDocumentExtension };
  }
  return null;
}

export function subscribeToDirectMessages(conversationId: string, listener: (items: DirectMessage[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(collection(getFirestore(getFirebaseApp()), 'directConversations', conversationId, 'messages'), orderBy('createdAt', 'desc'), limit(50)),
    (snapshot) => listener(snapshot?.docs.flatMap((item) => { const parsed = parseMessage(item); return parsed ? [parsed] : []; }) ?? []), onError);
}

export async function fetchOlderDirectMessages(conversationId: string, before: Date): Promise<{ hasMore: boolean; messages: DirectMessage[] }> {
  const snapshot = await getDocs(query(messagesCollection(conversationId), orderBy('createdAt', 'desc'), startAfter(Timestamp.fromDate(before)), limit(50)));
  return { hasMore: snapshot.size === 50, messages: snapshot.docs.flatMap((item) => { const parsed = parseMessage(item); return parsed ? [parsed] : []; }) };
}

export function subscribeToDirectUnreadCount(conversationId: string, uid: string, listener: (count: number) => void): () => void {
  return onSnapshot(doc(getFirestore(getFirebaseApp()), 'directConversations', conversationId, 'participantStates', uid),
    (snapshot) => listener(snapshot ? Math.max(0, Number(snapshot.get('unreadCount')) || 0) : 0), () => listener(0));
}

export function subscribeToDirectParticipantState(conversationId: string, uid: string, listener: (state: DirectParticipantState) => void): () => void {
  return onSnapshot(doc(getFirestore(getFirebaseApp()), 'directConversations', conversationId, 'participantStates', uid),
    (snapshot) => listener({ hidden: snapshot?.get('hidden') === true, messagingAllowed: snapshot?.get('messagingAllowed') !== false, unreadCount: Math.max(0, Number(snapshot?.get('unreadCount')) || 0) }),
    () => listener({ hidden: false, messagingAllowed: true, unreadCount: 0 }));
}

export function subscribeToDirectReadCursor(conversationId: string, uid: string, listener: (date: Date | null) => void): () => void {
  return onSnapshot(doc(getFirestore(getFirebaseApp()), 'directConversations', conversationId, 'readCursors', uid), (snapshot) => {
    const value = snapshot?.get('lastReadMessageCreatedAt');
    listener(value instanceof Timestamp ? value.toDate() : null);
  }, () => listener(null));
}

export function subscribeToDirectBlockState(uid: string, targetUid: string, listener: (blocked: boolean) => void): () => void {
  return onSnapshot(doc(getFirestore(getFirebaseApp()), 'users', uid, 'blockedUsers', targetUid), (snapshot) => listener(Boolean(snapshot?.exists())), () => listener(false));
}

export function subscribeToBlockedUserIds(uid: string, listener: (blockedUserIds: ReadonlySet<string>) => void): () => void {
  return onSnapshot(collection(getFirestore(getFirebaseApp()), 'users', uid, 'blockedUsers'),
    (snapshot) => listener(new Set(snapshot?.docs.map((item) => item.id) ?? [])),
    () => listener(new Set()));
}

function messagesCollection(conversationId: string) { return collection(getFirestore(getFirebaseApp()), 'directConversations', conversationId, 'messages'); }

function directDraftBase(id: string, senderUid: string, replyToMessageId: string | null) {
  return {
    id,
    senderUid,
    createdAt: null,
    clientCreatedAt: new Date(),
    status: 'pending' as const,
    deletedForEveryone: false,
    deletedAt: null,
    deletedBy: null,
    replyToMessageId,
  };
}

export function createDirectMessageId(conversationId: string): string {
  return doc(messagesCollection(conversationId)).id;
}

export function createDirectTextMessageDraft(
  conversationId: string,
  senderUid: string,
  text: string,
  replyToMessageId: string | null = null,
): Extract<DirectMessage, { type: 'text' }> {
  return {
    ...directDraftBase(createDirectMessageId(conversationId), senderUid, replyToMessageId),
    type: 'text',
    text: normalizeDevreChatText(text),
  };
}

export function createDirectImageMessageDraft(input: {
  caption: string;
  conversationId: string;
  height: number;
  localMediaUri: string;
  messageId: string;
  replyToMessageId: string | null;
  senderUid: string;
  width: number;
}): Extract<DirectMessage, { type: 'image' }> {
  return {
    ...directDraftBase(input.messageId, input.senderUid, input.replyToMessageId),
    type: 'image',
    caption: normalizeDevreChatText(input.caption),
    height: input.height,
    localMediaUri: input.localMediaUri,
    mediaPath: getDirectChatMediaPath(input.conversationId, input.messageId, 'image'),
    width: input.width,
  };
}

export function createDirectDocumentMessageDraft(input: {
  conversationId: string;
  extension: DevreChatDocumentExtension;
  fileName: string;
  localMediaUri: string;
  messageId: string;
  mimeType: string;
  replyToMessageId: string | null;
  senderUid: string;
  sizeBytes: number;
}): Extract<DirectMessage, { type: 'document' }> {
  return {
    ...directDraftBase(input.messageId, input.senderUid, input.replyToMessageId),
    type: 'document',
    extension: input.extension,
    fileName: input.fileName,
    localMediaUri: input.localMediaUri,
    mediaPath: getDirectChatMediaPath(input.conversationId, input.messageId, 'document'),
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  };
}

export async function sendDirectMessage(conversationId: string, message: DirectMessage): Promise<void> {
  if (message.type === 'text') {
    if (!message.text || message.text.length > 1500) throw new Error('invalid-message');
  } else {
    if (!message.localMediaUri) throw new Error('missing-local-media');
    await uploadDirectChatMedia({
      conversationId,
      kind: message.type,
      localUri: message.localMediaUri,
      messageId: message.id,
      senderUid: message.senderUid,
      document: message.type === 'document'
        ? { extension: message.extension, fileName: message.fileName, mimeType: message.mimeType }
        : undefined,
    });
  }
  const common = {
    id: message.id,
    senderUid: message.senderUid,
    createdAt: serverTimestamp(),
    clientCreatedAt: Timestamp.fromDate(message.clientCreatedAt),
    replyToMessageId: message.replyToMessageId,
    schemaVersion: 1,
  };
  const data = message.type === 'text'
    ? { ...common, type: 'text', text: message.text }
    : message.type === 'image'
      ? { ...common, type: 'image', mediaPath: message.mediaPath, caption: message.caption, width: message.width, height: message.height }
      : { ...common, type: 'document', mediaPath: message.mediaPath, extension: message.extension, fileName: message.fileName, mimeType: message.mimeType, sizeBytes: message.sizeBytes };
  await setDoc(doc(messagesCollection(conversationId), message.id), data);
}

export async function deleteDirectMessageForEveryone(conversationId: string, messageId: string, uid: string): Promise<void> {
  await updateDoc(doc(messagesCollection(conversationId), messageId), { deletedForEveryone: true, deletedAt: serverTimestamp(), deletedBy: uid });
}

export async function hideDirectMessageForUser(uid: string, conversationId: string, messageId: string): Promise<void> {
  await setDoc(doc(getFirestore(getFirebaseApp()), 'users', uid, 'hiddenDirectMessages', conversationId, 'messages', messageId), {
    conversationId, messageId, hiddenAt: serverTimestamp(),
  });
}

export async function fetchHiddenDirectMessageIds(uid: string, conversationId: string, messageIds: readonly string[]): Promise<Set<string>> {
  const result = new Set<string>();
  const hidden = collection(getFirestore(getFirebaseApp()), 'users', uid, 'hiddenDirectMessages', conversationId, 'messages');
  for (let index = 0; index < messageIds.length; index += 30) {
    const ids = messageIds.slice(index, index + 30);
    if (!ids.length) continue;
    const snapshot = await getDocs(query(hidden, where(documentId(), 'in', ids)));
    snapshot.docs.forEach((item) => result.add(item.id));
  }
  return result;
}

export async function markDirectConversationRead(conversationId: string, uid: string, message: DirectMessage): Promise<void> {
  if (!message.createdAt) return;
  const database = getFirestore(getFirebaseApp());
  const batch = writeBatch(database);
  batch.set(doc(database, 'directConversations', conversationId, 'readCursors', uid), {
    uid, lastReadMessageId: message.id, lastReadMessageCreatedAt: Timestamp.fromDate(message.createdAt), lastReadAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(database, 'directConversations', conversationId, 'participantStates', uid), { uid, unreadCount: 0, lastReadAt: serverTimestamp() }, { merge: true });
  await batch.commit();
}

export async function blockDirectMessageUser(uid: string, targetUid: string): Promise<void> {
  await setDoc(doc(getFirestore(getFirebaseApp()), 'users', uid, 'blockedUsers', targetUid), { blockedUid: targetUid, createdAt: serverTimestamp() });
}
export async function unblockDirectMessageUser(uid: string, targetUid: string): Promise<void> {
  await deleteDoc(doc(getFirestore(getFirebaseApp()), 'users', uid, 'blockedUsers', targetUid));
}

export async function hideDirectConversation(uid: string, conversationId: string): Promise<void> {
  await setDoc(doc(getFirestore(getFirebaseApp()), 'directConversations', conversationId, 'participantStates', uid), {
    uid, unreadCount: 0, hidden: true, hiddenAt: serverTimestamp(),
  }, { merge: true });
}

export const directReportReasons = ['Spam', 'Taciz / rahatsız etme', 'Uygunsuz içerik', 'Sahte / yanıltıcı profil', 'Diğer'] as const;
export async function reportDirectMessageUser(input: { conversationId: string; messageId?: string | null; reason: typeof directReportReasons[number]; reportedUid: string; reporterUid: string }): Promise<void> {
  await addDoc(collection(getFirestore(getFirebaseApp()), 'moderationReports'), { ...input, conversationType: 'direct', messageId: input.messageId ?? null, status: 'open', createdAt: serverTimestamp() });
}
