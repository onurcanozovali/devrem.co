import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const CHAT_IMAGE_MAX_DIMENSION = 1600;

export interface SelectedChatImage {
  height: number;
  uri: string;
  width: number;
}
function parseImageResult(result: ImagePicker.ImagePickerResult): SelectedChatImage | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || asset.type !== 'image' || !asset.uri || asset.width <= 0 || asset.height <= 0) {
    throw new Error('invalid-chat-image');
  }
  return { height: asset.height, uri: asset.uri, width: asset.width };
}

export async function selectChatPhoto(): Promise<SelectedChatImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('library-permission-denied');
  return parseImageResult(await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: false,
    mediaTypes: ['images'],
    quality: 1,
    selectionLimit: 1,
  }));
}

export async function prepareChatImage(image: SelectedChatImage): Promise<SelectedChatImage> {
  const scale = Math.min(1, CHAT_IMAGE_MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const context = ImageManipulator.manipulate(image.uri);
  if (scale < 1) context.resize({ height, width });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: 0.78, format: SaveFormat.JPEG });
  return { height: result.height, uri: result.uri, width: result.width };
}
