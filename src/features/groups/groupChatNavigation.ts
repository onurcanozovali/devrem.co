export const groupChatReturnPaths = [
  '/(tabs)',
  '/(tabs)/preparation',
  '/(tabs)/matching',
  '/(tabs)/chats',
  '/(tabs)/profile',
] as const;

export type GroupChatReturnPath = typeof groupChatReturnPaths[number];

let returnPath: GroupChatReturnPath = '/(tabs)';

export function rememberGroupChatReturnTab(routeName: string | undefined): void {
  const paths: Record<string, GroupChatReturnPath> = {
    index: '/(tabs)',
    preparation: '/(tabs)/preparation',
    matching: '/(tabs)/matching',
    chats: '/(tabs)/chats',
    profile: '/(tabs)/profile',
  };
  if (routeName && paths[routeName]) returnPath = paths[routeName];
}

export function getGroupChatReturnPath(): GroupChatReturnPath {
  return returnPath;
}

export function parseGroupChatReturnPath(value: string | string[] | undefined): GroupChatReturnPath | null {
  return typeof value === 'string' && groupChatReturnPaths.some((path) => path === value)
    ? value as GroupChatReturnPath
    : null;
}
