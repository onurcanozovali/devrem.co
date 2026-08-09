import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { ProfilePhotoFlowError, profilePhotoSize } from './profilePhotoDomain';

export interface SelectedProfilePhoto {
  uri: string;
  width: number;
  height: number;
}

export async function selectProfilePhoto(): Promise<SelectedProfilePhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ['images'],
    quality: 0.9,
    selectionLimit: 1,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || asset.type !== 'image' || !asset.uri || asset.width <= 0 || asset.height <= 0) {
    throw new ProfilePhotoFlowError('invalid-image');
  }
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

export async function prepareProfilePhoto(photo: SelectedProfilePhoto): Promise<string> {
  try {
    const side = Math.min(photo.width, photo.height);
    const context = ImageManipulator.manipulate(photo.uri);
    context
      .crop({
        height: side,
        originX: Math.floor((photo.width - side) / 2),
        originY: Math.floor((photo.height - side) / 2),
        width: side,
      })
      .resize({ height: profilePhotoSize, width: profilePhotoSize });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    if (!result.uri || result.width !== profilePhotoSize || result.height !== profilePhotoSize) {
      throw new ProfilePhotoFlowError('invalid-image');
    }
    return result.uri;
  } catch (error: unknown) {
    if (error instanceof ProfilePhotoFlowError) throw error;
    throw new ProfilePhotoFlowError('invalid-image');
  }
}