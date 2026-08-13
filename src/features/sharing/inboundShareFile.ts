import { File, Paths } from 'expo-file-system';
import type { ResolvedSharePayload } from 'expo-sharing';
import { Image } from 'react-native';

import type { SelectedChatImage } from '@/features/groups/chatMedia';
import {
  normalizeInboundShareMetadata,
  validateDocumentSignature,
  validateImageSignature,
  type PendingInboundShare,
} from './inboundShareDomain';

function readHead(file: File, length: number): Uint8Array {
  const handle = file.open();
  try { return handle.readBytes(length); } finally { handle.close(); }
}

function getImageSize(uri: string): Promise<Pick<SelectedChatImage, 'height' | 'width'>> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => {
      if (width > 0 && height > 0) resolve({ height, width });
      else reject(new Error('invalid-file-signature'));
    }, () => reject(new Error('invalid-file-signature')));
  });
}

export async function resolvePendingInboundShare(payloads: readonly ResolvedSharePayload[]): Promise<{
  image: SelectedChatImage | null;
  share: PendingInboundShare;
}> {
  if (payloads.length !== 1) throw new Error('multiple-share-not-supported');
  const payload = payloads[0]!;
  if (!payload.contentUri) throw new Error('unsafe-share-uri');
  const file = new File(payload.contentUri);
  if (!file.exists) throw new Error('empty-share-file');
  const actualSize = file.info().size;
  if (typeof actualSize !== 'number') throw new Error('empty-share-file');
  const share = normalizeInboundShareMetadata({ actualSize, cacheUri: Paths.cache.uri, payload });

  if (share.attachment.kind === 'image') {
    if (!validateImageSignature(share.attachment.mimeType, readHead(file, 16))) throw new Error('invalid-file-signature');
    const dimensions = await getImageSize(file.uri);
    return { image: { ...dimensions, uri: file.uri }, share };
  }

  if (!validateDocumentSignature(share.attachment.extension, await file.bytes())) throw new Error('invalid-file-signature');
  return { image: null, share };
}

export function deleteInboundShareFile(share: PendingInboundShare | null): void {
  if (!share) return;
  try {
    const file = new File(share.attachment.uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best-effort; Android may already have reclaimed the file.
  }
}
