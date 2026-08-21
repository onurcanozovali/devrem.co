import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ChatViewerImage {
  height: number;
  messageId: string;
  uri: string;
  width: number;
}

const DOUBLE_TAP_SCALE = 2;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

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
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  const aspectRatio = image.width / image.height;
  const viewportRatio = viewport.width / viewport.height;
  const baseWidth = aspectRatio > viewportRatio ? viewport.width : viewport.height * aspectRatio;
  const baseHeight = aspectRatio > viewportRatio ? viewport.width / aspectRatio : viewport.height;

  const clampedX = (value: number, nextScale: number) => {
    'worklet';
    const maximum = Math.max(0, (baseWidth * nextScale - viewport.width) / 2);
    return clamp(value, -maximum, maximum);
  };
  const clampedY = (value: number, nextScale: number) => {
    'worklet';
    const maximum = Math.max(0, (baseHeight * nextScale - viewport.height) / 2);
    return clamp(value, -maximum, maximum);
  };

  const pan = Gesture.Pan()
    .minDistance(2)
    .averageTouches(true)
    .onBegin(() => {
      startX.set(translateX.get());
      startY.set(translateY.get());
    })
    .onUpdate((event) => {
      const currentScale = scale.get();
      if (currentScale <= 1) {
        translateX.set(0);
        translateY.set(Math.max(0, event.translationY));
        backdropOpacity.set(1 - Math.min(0.78, Math.max(0, event.translationY) / viewport.height));
        return;
      }
      translateX.set(clampedX(startX.get() + event.translationX, currentScale));
      translateY.set(clampedY(startY.get() + event.translationY, currentScale));
    })
    .onEnd((event) => {
      if (scale.get() > 1) return;
      const shouldDismiss = event.translationY >= DISMISS_DISTANCE || event.velocityY >= DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.set(withTiming(viewport.height, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        }));
        backdropOpacity.set(withTiming(0, { duration: 180 }));
        return;
      }
      translateY.set(withTiming(0, { duration: 180 }));
      backdropOpacity.set(withTiming(1, { duration: 180 }));
    });

  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(260).onEnd((event, success) => {
    if (!success) return;
    if (scale.get() > 1) {
      scale.set(withTiming(1, { duration: 200 }));
      translateX.set(withTiming(0, { duration: 200 }));
      translateY.set(withTiming(0, { duration: 200 }));
      backdropOpacity.set(withTiming(1, { duration: 200 }));
      return;
    }
    const nextX = -(event.x - viewport.width / 2);
    const nextY = -(event.y - viewport.height / 2);
    scale.set(withTiming(DOUBLE_TAP_SCALE, { duration: 200 }));
    translateX.set(withTiming(clampedX(nextX, DOUBLE_TAP_SCALE), { duration: 200 }));
    translateY.set(withTiming(clampedY(nextY, DOUBLE_TAP_SCALE), { duration: 200 }));
  });

  const gestures = Gesture.Simultaneous(doubleTap, pan);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }, { translateY: translateY.get() }, { scale: scale.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.get() }));

  return (
    <Modal animationType="none" hardwareAccelerated onRequestClose={onClose} statusBarTranslucent transparent visible>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
          <Animated.View pointerEvents="none" style={[{ backgroundColor: '#000', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, backdropStyle]} />
          <GestureDetector gesture={gestures}>
            <Animated.Image
              accessibilityLabel="Tam ekran paylaşılan fotoğraf"
              fadeDuration={0}
              resizeMode="contain"
              source={{ uri: image.uri }}
              style={[{ height: '100%', width: '100%' }, animatedStyle]}
            />
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
      </GestureHandlerRootView>
    </Modal>
  );
}
