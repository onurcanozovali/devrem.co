import {
  Timestamp,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

import { normalizeDevreChatText, type DevreChatMessage } from '../../features/groups/chatDomain';
import { getFirebaseApp } from './app';
import { getChatMediaPath } from './chatMedia';

const PAGE_SIZE = 40;
export type DevreChatCursor = QueryDocumentSnapshot;
export interface DevreChatPage { messages: DevreChatMessage[]; cursor: DevreChatCursor | null; hasMore: boolean }

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

function draftBase(id: string, senderUid: string) {
  return { id, senderUid, createdAt: null, clientCreatedAt: new Date(), status: 'pending' as const };
}

export function createDevreChatMessageDraft(groupId: string, senderUid: string, text: string): DevreChatMessage {
  return { ...draftBase(createDevreChatMessageId(groupId), senderUid), type: 'text', text: normalizeDevreChatText(text) };
}

export function createImageMessageDraft(input: {
  caption: string; groupId: string; height: number; localMediaUri: string; messageId: string; senderUid: string; width: number;
}): DevreChatMessage {
  return {
    ...draftBase(input.messageId, input.senderUid), type: 'image', caption: normalizeDevreChatText(input.caption),
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

export async function sendDevreChatMessage(groupId: string, message: DevreChatMessage): Promise<void> {
  const common = {
    id: message.id, senderUid: message.senderUid, type: message.type,
    createdAt: serverTimestamp(), clientCreatedAt: Timestamp.fromDate(message.clientCreatedAt), schemaVersion: 2,
  };
  const data = message.type === 'text' ? { ...common, text: message.text }
    : message.type === 'image' ? {
      ...common, mediaPath: message.mediaPath, caption: message.caption, width: message.width, height: message.height,
    } : { ...common, mediaPath: message.mediaPath, durationMillis: message.durationMillis };
  await setDoc(doc(messagesCollection(groupId), message.id), data);
}

export function subscribeToRecentDevreChatMessages(groupId: string, onPage: (page: DevreChatPage) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(messagesCollection(groupId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)), (snapshot) => onPage(parsePage(snapshot)), onError);
}

export async function fetchOlderDevreChatMessages(groupId: string, cursor: DevreChatCursor): Promise<DevreChatPage> {
  return parsePage(await getDocs(query(messagesCollection(groupId), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE))));
}

export async function fetchRecentGroupImages(groupId: string, count = 24): Promise<DevreChatMessage[]> {
  const snapshot = await getDocs(query(messagesCollection(groupId), where('type', '==', 'image'), orderBy('createdAt', 'desc'), limit(count)));
  return parsePage(snapshot).messages.filter((message) => message.type === 'image');
}
