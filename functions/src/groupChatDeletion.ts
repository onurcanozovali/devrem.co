import { logger } from 'firebase-functions';

interface MediaBucket {
  file: (path: string) => { delete: (options: { ignoreNotFound: boolean }) => Promise<unknown> };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deletedGroupMessageMediaPath(
  groupId: string,
  messageId: string,
  before: unknown,
  after: unknown,
): string | null {
  if (!isRecord(before) || !isRecord(after) || before.deletedForEveryone === true || after.deletedForEveryone !== true) return null;
  if (
    typeof before.senderUid !== 'string' || after.senderUid !== before.senderUid
    || after.deletedBy !== before.senderUid || typeof before.type !== 'string'
  ) return null;
  const fileName = before.type === 'image' ? 'image.jpg'
    : before.type === 'audio' ? 'audio.m4a'
      : before.type === 'document' ? 'document' : null;
  if (!fileName) return null;
  const expected = `devreGroups/${groupId}/media/${messageId}/${fileName}`;
  return before.mediaPath === expected && after.mediaPath === expected ? expected : null;
}

export async function cleanupDeletedGroupMessageMedia(input: {
  after: unknown; before: unknown; bucket: MediaBucket; groupId: string; messageId: string;
}): Promise<void> {
  const path = deletedGroupMessageMediaPath(input.groupId, input.messageId, input.before, input.after);
  if (!path) return;
  await input.bucket.file(path).delete({ ignoreNotFound: true });
  logger.info('Deleted group message media cleaned up.', { groupId: input.groupId, messageId: input.messageId });
}
