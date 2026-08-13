import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

import { getDocumentOpenDescriptor } from './documentOpenDomain';

export async function openLocalChatDocument(localUri: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'android') {
    const descriptor = getDocumentOpenDescriptor(mimeType);
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    await IntentLauncher.startActivityAsync(descriptor.action, {
      data: contentUri,
      flags: descriptor.flags,
      type: descriptor.mimeType,
    });
    return;
  }

  await Linking.openURL(localUri);
}
