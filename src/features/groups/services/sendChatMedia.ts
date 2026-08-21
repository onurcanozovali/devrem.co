import { sendDevreChatMessage, uploadChatMedia } from '@/services/firebase';
import type { DevreChatMessage } from '../chatDomain';

export async function uploadAndSendDevreChatMediaMessage(
  groupId: string,
  message: Extract<DevreChatMessage, { type: 'image' | 'audio' | 'document' }>,
): Promise<void> {
  if (!message.localMediaUri) throw new Error('missing-local-media');
  await uploadChatMedia({
    groupId,
    kind: message.type,
    localUri: message.localMediaUri,
    messageId: message.id,
    senderUid: message.senderUid,
    document: message.type === 'document'
      ? { extension: message.extension, fileName: message.fileName, mimeType: message.mimeType }
      : undefined,
  });
  await sendDevreChatMessage(groupId, message);
}
