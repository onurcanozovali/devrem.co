export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path);
    return url.hostname === 'expo-sharing' ? '/share-confirmation' : path;
  } catch {
    return '/';
  }
}
