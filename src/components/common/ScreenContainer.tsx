import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

interface ScreenContainerProps extends ScrollViewProps {
  scrollable?: boolean;
}

export function ScreenContainer({ children, scrollable = true, contentContainerStyle, ...props }: PropsWithChildren<ScreenContainerProps>) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          {...props}
          scrollEnabled={scrollable}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { padding: spacing.lg }, !scrollable && styles.flex, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1 }, flex: { flex: 1 }, content: { flexGrow: 1 } });
