import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';

export function useChatKeyboardOffset() {
  const keyboardHeight = useSharedValue(0);

  useKeyboardHandler({
    onMove: (event) => {
      'worklet';
      keyboardHeight.set(event.height);
    },
    onInteractive: (event) => {
      'worklet';
      keyboardHeight.set(event.height);
    },
    onEnd: (event) => {
      'worklet';
      keyboardHeight.set(event.height);
    },
  }, [keyboardHeight]);

  return keyboardHeight;
}
