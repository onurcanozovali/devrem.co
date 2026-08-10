import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { SelectedChatImage } from './chatMedia';

export function ChatCameraModal({ onClose, onPhoto, visible }: {
  onClose: () => void;
  onPhoto: (photo: SelectedChatImage) => void;
  visible: boolean;
}) {
  const { colors, spacing } = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission, visible]);
  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (photo?.uri && photo.width > 0 && photo.height > 0) {
        onPhoto({ height: photo.height, uri: photo.uri, width: photo.width });
      }
    } finally { setCapturing(false); }
  };
  return <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
    <SafeAreaView style={{ backgroundColor: '#000', flex: 1 }}>
      {!permission ? <ActivityIndicator color={colors.primary} style={{ flex: 1 }} /> : permission.granted ? (
        <View style={{ flex: 1 }}>
          <CameraView facing={facing} flash={flash} mode="picture" ref={cameraRef} style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', left: 0, padding: spacing.md, position: 'absolute', right: 0, top: 0 }}>
            <CameraControl icon="close" label="Kamerayı kapat" onPress={onClose} />
            <CameraControl icon={flash === 'off' ? 'flash-off' : 'flash'} label="Flaşı değiştir" onPress={() => setFlash((current) => current === 'off' ? 'on' : 'off')} />
          </View>
          <View style={{ alignItems: 'center', bottom: spacing.xl, flexDirection: 'row', justifyContent: 'space-around', left: 0, position: 'absolute', right: 0 }}>
            <View style={{ width: 58 }} />
            <Pressable accessibilityLabel="Fotoğraf çek" disabled={capturing} onPress={() => void capture()} style={{ alignItems: 'center', borderColor: '#fff', borderRadius: 44, borderWidth: 5, height: 88, justifyContent: 'center', opacity: capturing ? 0.55 : 1, width: 88 }}><View style={{ backgroundColor: '#fff', borderRadius: 34, height: 66, width: 66 }} /></Pressable>
            <CameraControl icon="camera-reverse" label="Kamerayı çevir" onPress={() => setFacing((current) => current === 'back' ? 'front' : 'back')} />
          </View>
        </View>
      ) : (
        <View style={{ alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons color="#fff" name="camera-outline" size={48} />
          <AppText style={{ color: '#fff', textAlign: 'center' }} variant="subtitle" weight="800">Kamera izni gerekli</AppText>
          <AppText style={{ color: '#ccc', textAlign: 'center' }}>Devre grubunda fotoğraf çekmek için kamera iznini açmalısın.</AppText>
          <Pressable onPress={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()} style={{ backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}><AppText style={{ color: colors.textInverse }} weight="800">{permission.canAskAgain ? 'İzin Ver' : 'Ayarları Aç'}</AppText></Pressable>
          <Pressable onPress={onClose}><AppText style={{ color: '#fff' }}>Vazgeç</AppText></Pressable>
        </View>
      )}
    </SafeAreaView>
  </Modal>;
}

function CameraControl({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={{ alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 29, height: 58, justifyContent: 'center', width: 58 }}><Ionicons color="#fff" name={icon} size={28} /></Pressable>;
}
