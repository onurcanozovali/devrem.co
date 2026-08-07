import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function RootNavigator() {
  const { colorScheme, colors } = useTheme();
  const { status, initializationError } = useAuth();

  if (status === 'initializing') {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <LoadingState label="Oturumunuz hazırlanıyor…" />
      </ScreenContainer>
    );
  }

  if (initializationError) {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <EmptyState title="Uygulama yapılandırılamadı" description={initializationError} />
      </ScreenContainer>
    );
  }

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={status === 'unauthenticated'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
