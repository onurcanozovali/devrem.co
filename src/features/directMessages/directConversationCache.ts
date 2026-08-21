const visibleConversationIdsByPair = new Map<string, string>();
const participantUidsByConversationId = new Map<string, readonly [string, string]>();

function pairKey(uidA: string, uidB: string): string {
  return [uidA.trim(), uidB.trim()].sort().join('\u0000');
}

export function getCachedVisibleDirectConversationId(uid: string, recipientUid: string): string | null {
  if (!uid || !recipientUid || uid === recipientUid) return null;
  return visibleConversationIdsByPair.get(pairKey(uid, recipientUid)) ?? null;
}

export function rememberVisibleDirectConversation(uid: string, recipientUid: string, conversationId: string): void {
  if (!uid || !recipientUid || uid === recipientUid || !conversationId) return;
  visibleConversationIdsByPair.set(pairKey(uid, recipientUid), conversationId);
  participantUidsByConversationId.set(conversationId, [uid, recipientUid]);
}

export function getCachedDirectRecipientUid(conversationId: string, uid: string): string | null {
  const participants = participantUidsByConversationId.get(conversationId);
  return participants?.find((participantUid) => participantUid !== uid) ?? null;
}

export function forgetVisibleDirectConversation(uid: string, recipientUid: string): void {
  if (!uid || !recipientUid || uid === recipientUid) return;
  visibleConversationIdsByPair.delete(pairKey(uid, recipientUid));
}

export function clearVisibleDirectConversationCache(): void {
  visibleConversationIdsByPair.clear();
  participantUidsByConversationId.clear();
}
