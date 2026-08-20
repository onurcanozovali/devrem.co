import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ChatViewerImage {
  height: number;
  messageId: string;
  uri: string;
  width: number;
}

const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function ChatImageViewer({ image, onClose }: { image: ChatViewerImage; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const aspectRatio = image.width / image.height;
  const viewportRatio = viewport.width / viewport.height;
  const baseWidth = aspectRatio > viewportRatio ? viewport.width : viewport.height * aspectRatio;
  const baseHeight = aspectRatio > viewportRatio ? viewport.width / aspectRatio : viewport.height;

  const settle = () => {
    'worklet';
    const maxX = Math.max(0, (baseWidth * scale.value - viewport.width) / 2);
    const maxY = Math.max(0, (baseHeight * scale.value - viewport.height) / 2);
    translateX.value = withTiming(clamp(translateX.value, -maxX, maxX), { duration: 160 });
    translateY.value = withTiming(clamp(translateY.value, -maxY, maxY), { duration: 160 });
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextScale = clamp(startScale.value * event.scale, 1, MAX_SCALE);
      const ratio = nextScale / startScale.value;
      scale.value = nextScale;
      translateX.value = startX.value + (1 - ratio) * (event.focalX - viewport.width / 2 - startX.value);
      translateY.value = startY.value + (1 - ratio) * (event.focalY - viewport.height / 2 - startY.value);
    })
    .onEnd(settle);

  const pan = Gesture.Pan()
    .minDistance(2)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(settle);

  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(260).onEnd((event, success) => {
    if (!success) return;
    if (scale.value > 1) {
      scale.value = withTiming(1, { duration: 180 });
      translateX.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(0, { duration: 180 });
      return;
    }
    scale.value = withTiming(2, { duration: 180 });
    translateX.value = withTiming(-(event.x - viewport.width / 2), { duration: 180 });
    translateY.value = withTiming(-(event.y - viewport.height / 2), { duration: 180 }, () => settle());
  });

  const singleTap = Gesture.Tap().numberOfTaps(1).onEnd((_event, success) => {
    if (success && scale.value === 1) runOnJS(onClose)();
  });

  const gestures = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan), singleTap);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Modal animationType="none" hardwareAccelerated onRequestClose={onClose} statusBarTranslucent visible>
      <View style={{ backgroundColor: '#000', flex: 1 }}>
        <GestureDetector gesture={gestures}>
          <Animated.View style={{ flex: 1 }}>
            <Animated.Image
              accessibilityLabel="Tam ekran paylaşılan fotoğraf"
              fadeDuration={0}
              resizeMode="contain"
              source={{ uri: image.uri }}
              style={[{ height: '100%', width: '100%' }, animatedStyle]}
            />
          </Animated.View>
        </GestureDetector>
        <Pressable
          accessibilityLabel="Fotoğrafı kapat"
          accessibilityRole="button"
          onPress={onClose}
          style={{ alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 24, height: 48, justifyContent: 'center', left: 12, position: 'absolute', top: insets.top + 8, width: 48 }}
        >
          <Ionicons color="#fff" name="close" size={30} />
        </Pressable>
      </View>
    </Modal>
  );
}
