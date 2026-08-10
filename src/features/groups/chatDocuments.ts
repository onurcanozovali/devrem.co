import * as DocumentPicker from 'expo-document-picker';

import {
  DEVRE_CHAT_DOCUMENT_MAX_BYTES,
  devreChatDocumentExtensions,
  devreChatDocumentMimeTypes,
  type DevreChatDocumentExtension,
} from './chatDomain';

export interface SelectedChatDocument {
  extension: DevreChatDocumentExtension;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uri: string;
}

const allowedMimeTypes = Object.values(devreChatDocumentMimeTypes);

export async function selectChatDocument(): Promise<SelectedChatDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: allowedMimeTypes,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const extension = asset?.name.split('.').at(-1)?.toLowerCase();
  if (
    !asset
    || !asset.uri
    || !asset.name
    || typeof asset.size !== 'number'
    || !extension
    || !devreChatDocumentExtensions.includes(extension as DevreChatDocumentExtension)
  ) throw new Error('unsupported-document');
  const typedExtension = extension as DevreChatDocumentExtension;
  const expectedMime = devreChatDocumentMimeTypes[typedExtension];
  if (asset.mimeType !== expectedMime) throw new Error('unsupported-document');
  if (asset.size <= 0 || asset.size > DEVRE_CHAT_DOCUMENT_MAX_BYTES) throw new Error('document-too-large');
  return {
    extension: typedExtension,
    fileName: asset.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120),
    mimeType: expectedMime,
    sizeBytes: asset.size,
    uri: asset.uri,
  };
}
