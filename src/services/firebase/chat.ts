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
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

import {
  normalizeDevreChatText,
  type DevreChatMessage,
} from '../../features/groups/chatDomain';
import { getFirebaseApp } from './app';

const PAGE_SIZE = 40;

export type DevreChatCursor = QueryDocumentSnapshot;

export interface DevreChatPage {
  messages: DevreChatMessage[];
  cursor: DevreChatCursor | null;
  hasMore: boolean;
}

function messagesCollection(groupId: string) {
  return collection(getFirestore(getFirebaseApp()), 'devreGroups', groupId, 'messages');
}

function parseMessage(snapshot: QueryDocumentSnapshot): DevreChatMessage | null {
  const data = snapshot.data();
  if (
    data.id !== snapshot.id
    || typeof data.senderUid !== 'string'
    || typeof data.text !== 'string'
    || !(data.clientCreatedAt instanceof Timestamp)
  ) return null;

  return {
    id: snapshot.id,
    senderUid: data.senderUid,
    text: data.text,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    clientCreatedAt: data.clientCreatedAt.toDate(),
    status: snapshot.metadata.hasPendingWrites ? 'pending' : 'sent',
  };
}

function parsePage(snapshot: QuerySnapshot): DevreChatPage {
  return {
    messages: snapshot.docs.flatMap((documentSnapshot) => {
      const parsed = parseMessage(documentSnapshot);
      return parsed ? [parsed] : [];
    }),
    cursor: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.size === PAGE_SIZE,
  };
}

export function createDevreChatMessageDraft(
  groupId: string,
  senderUid: string,
  text: string,
): DevreChatMessage {
  return {
    id: doc(messagesCollection(groupId)).id,
    senderUid,
    text: normalizeDevreChatText(text),
    createdAt: null,
    clientCreatedAt: new Date(),
    status: 'pending',
  };
}

export async function sendDevreChatMessage(
  groupId: string,
  message: DevreChatMessage,
): Promise<void> {
  await setDoc(doc(messagesCollection(groupId), message.id), {
    id: message.id,
    senderUid: message.senderUid,
    text: message.text,
    createdAt: serverTimestamp(),
    clientCreatedAt: Timestamp.fromDate(message.clientCreatedAt),
    schemaVersion: 1,
  });
}

export function subscribeToRecentDevreChatMessages(
  groupId: string,
  onPage: (page: DevreChatPage) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(messagesCollection(groupId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)),
    (snapshot) => onPage(parsePage(snapshot)),
    onError,
  );
}

export async function fetchOlderDevreChatMessages(
  groupId: string,
  cursor: DevreChatCursor,
): Promise<DevreChatPage> {
  return parsePage(await getDocs(query(
    messagesCollection(groupId),
    orderBy('createdAt', 'desc'),
    startAfter(cursor),
    limit(PAGE_SIZE),
  )));
}
