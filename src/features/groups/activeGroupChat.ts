let activeGroupId: string | null = null;

export function getActiveDevreGroupChatId(): string | null {
  return activeGroupId;
}

export function setActiveDevreGroupChatId(groupId: string | null): void {
  activeGroupId = groupId;
}
