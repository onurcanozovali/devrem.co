import * as DocumentPicker from 'expo-document-picker';

import {
  devreChatDocumentMimeTypes,
  normalizeSelectedChatDocument,
  type NormalizedChatDocument,
} from './chatDomain';

export type SelectedChatDocument = NormalizedChatDocument;

const allowedMimeTypes = Object.values(devreChatDocumentMimeTypes);

export async function selectChatDocument(): Promise<SelectedChatDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: allowedMimeTypes,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || typeof asset.size !== 'number') throw new Error('unsupported-document');
  return normalizeSelectedChatDocument({ mimeType: asset.mimeType, name: asset.name, size: asset.size, uri: asset.uri });
}
