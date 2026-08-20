export const CHAT_NEAR_LATEST_THRESHOLD = 96;

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
