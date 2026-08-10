let suppressNextAutomaticOpen = false;

export function markReturningFromGroupChat(): void {
  suppressNextAutomaticOpen = true;
}

export function consumeGroupChatReturnSuppression(): boolean {
  if (!suppressNextAutomaticOpen) return false;
  suppressNextAutomaticOpen = false;
  return true;
}
