export const CHAT_NEAR_LATEST_THRESHOLD = 96;
export const CHAT_REPLY_SWIPE_THRESHOLD = 50;

export function isNearLatestOffset(
  offsetY: number,
  threshold = CHAT_NEAR_LATEST_THRESHOLD,
): boolean {
  return Number.isFinite(offsetY) && offsetY <= threshold;
}

export function shouldFollowLatest(isNearLatest: boolean): boolean {
  return isNearLatest;
}

export function countUnseenIncomingMessageIds(
  currentIds: ReadonlySet<string>,
  incoming: readonly { id: string; senderUid: string }[],
  currentUserId: string,
): number {
  return incoming.filter((message) => message.senderUid !== currentUserId && !currentIds.has(message.id)).length;
}

export function countUnreadIncomingMessages(
  messages: readonly { createdAt: Date | null; senderUid: string }[],
  currentUserId: string,
  lastReadAt: Date | null,
): number {
  const cutoff = lastReadAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  return messages.filter((message) => (
    message.senderUid !== currentUserId
    && message.createdAt !== null
    && message.createdAt.getTime() > cutoff
  )).length;
}

export function shouldTriggerSwipeReply(translationX: number, _own: boolean): boolean {
  'worklet';
  return Number.isFinite(translationX) && translationX >= CHAT_REPLY_SWIPE_THRESHOLD;
}
