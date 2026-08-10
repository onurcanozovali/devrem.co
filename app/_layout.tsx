import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo } from 'react';

import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ProfileProvider } from '@/features/profile/ProfileProvider';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { PreparationProvider } from '@/features/preparation/PreparationProvider';
import { NotificationProvider } from '@/features/notifications/NotificationProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function RootNavigator() {
  const { colors } = useTheme();
  const { status, initializationError } = useAuth();
  const { status: profileStatus, error: profileError, refreshProfile } = useProfile();

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

  if (status === 'authenticated' && (profileStatus === 'idle' || profileStatus === 'loading')) {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <LoadingState label="Profiliniz hazırlanıyor…" />
      </ScreenContainer>
    );
  }

  if (status === 'authenticated' && profileStatus === 'error') {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <EmptyState
          title="Profil yüklenemedi"
          description={profileError ?? 'Profil bilgileri yüklenirken bir sorun oluştu.'}
          actionLabel="Tekrar dene"
          onAction={() => void refreshProfile()}
        />
      </ScreenContainer>
    );
  }

  return (
    <NotificationProvider>
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
        <Stack.Protected guard={status === 'authenticated' && (profileStatus === 'missing' || profileStatus === 'incomplete')}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated' && profileStatus === 'complete'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="devre/[userId]" />
          <Stack.Screen name="notifications" />
        </Stack.Protected>
      </Stack>
    </NotificationProvider>
  );
}

function ThemedStatusBar() {
  const { resolvedScheme } = useTheme();
  return <StatusBar animated style={resolvedScheme === 'dark' ? 'light' : 'dark'} />;
}

const DataProviders = memo(function DataProviders() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ProfileProvider>
          <PreparationProvider>
            <RootNavigator />
          </PreparationProvider>
        </ProfileProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <DataProviders />
    </ThemeProvider>
  );
}
