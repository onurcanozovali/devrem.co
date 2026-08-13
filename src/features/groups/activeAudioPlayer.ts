let active: { id: string; pause: () => void } | null = null;

export function activateChatAudio(id: string, pause: () => void): void {
  if (active?.id !== id) active?.pause();
  active = { id, pause };
}

export function clearChatAudio(id: string): void {
  if (active?.id === id) active = null;
}
