import { Stack as NativeStack } from 'expo-router';
import { Stack as JavaScriptStack } from 'expo-router/js-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { memo, useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { EmptyState } from '@/components/common/EmptyState';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getAppConfig } from '@/config/env';
import { ProfileProvider } from '@/features/profile/ProfileProvider';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { PreparationProvider } from '@/features/preparation/PreparationProvider';
import { NotificationProvider } from '@/features/notifications/NotificationProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.setOptions({ duration: 0, fade: false });
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { status, initializationError, legalStatus, legalError, refreshLegalAcceptance } = useAuth();
  const { status: profileStatus, error: profileError, refreshProfile } = useProfile();
  const useJavaScriptStack = Platform.OS === 'android';
  const Stack = useJavaScriptStack ? JavaScriptStack : NativeStack;
  const enforceLegalGate = getAppConfig().environment === 'production';
  const hasCurrentLegalAcceptance = legalStatus === 'current';
  const isProfileDecisionPending = status === 'authenticated'
    && (profileStatus === 'idle' || profileStatus === 'loading');
  const isLegalDecisionPending = status === 'authenticated'
    && enforceLegalGate
    && (legalStatus === 'idle' || legalStatus === 'loading');
  const isBootDecisionPending = status === 'initializing'
    || isProfileDecisionPending
    || isLegalDecisionPending;

  useEffect(() => {
    if (!isBootDecisionPending) void SplashScreen.hideAsync().catch(() => undefined);
  }, [isBootDecisionPending]);

  if (isBootDecisionPending) return null;

  if (initializationError) {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <EmptyState title="Uygulama yapılandırılamadı" description={initializationError} />
      </ScreenContainer>
    );
  }

  if (status === 'authenticated' && enforceLegalGate && legalStatus === 'error') {
    return (
      <ScreenContainer scrollable={false} contentContainerStyle={{ justifyContent: 'center' }}>
        <EmptyState title="Yasal tercihler yüklenemedi" description={legalError ?? 'Lütfen tekrar deneyin.'} actionLabel="Tekrar dene" onAction={() => void refreshLegalAcceptance()} />
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
        detachInactiveScreens={useJavaScriptStack ? false : undefined}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="share-confirmation" />
        <Stack.Screen name="legal" />
        <Stack.Protected guard={status === 'unauthenticated'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated' && (profileStatus === 'missing' || profileStatus === 'incomplete') && (!enforceLegalGate || hasCurrentLegalAcceptance)}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated' && enforceLegalGate && legalStatus === 'required'}>
          <Stack.Screen name="legal-update" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'authenticated' && profileStatus === 'complete' && (!enforceLegalGate || hasCurrentLegalAcceptance)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="devre/[userId]" />
          <Stack.Screen name="group-chat/[groupId]" />
          <Stack.Screen name="group-info/[groupId]" />
          <Stack.Screen name="group-media/[groupId]" />
          <Stack.Screen name="direct-chat/[conversationId]" />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider preload>
        <ThemeProvider>
          <ThemedStatusBar />
          <DataProviders />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
