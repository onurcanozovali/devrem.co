import { Ionicons } from '@expo/vector-icons';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { usePathname, useRouter } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  deleteCurrentNotificationDevice,
  fetchNotificationPreferences,
  getInitialOpenedNotification,
  getNotificationPermissionState,
  registerCurrentNotificationDevice,
  requestNotificationPermission,
  saveNotificationPreferences,
  subscribeToForegroundNotifications,
  subscribeToNotificationTokenRefresh,
  subscribeToOpenedNotifications,
} from '@/services/firebase';
import { useTheme } from '@/theme/ThemeProvider';
import { defaultNotificationPreferences, parseNotificationTarget } from './services/notificationDomain';
import type {
  DiscoveryNotificationPreferences,
  NotificationPermissionState,
  NotificationPreferences,
  NotificationTarget,
} from './types/notifications';

type NotificationStatus = 'idle' | 'loading' | 'ready' | 'saving';

interface NotificationContextValue {
  error: string | null;
  permission: NotificationPermissionState;
  preferences: NotificationPreferences;
  refreshPermission: () => Promise<void>;
  setDiscoveryPreference: (
    key: keyof DiscoveryNotificationPreferences,
    enabled: boolean,
  ) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  status: NotificationStatus;
}

interface ForegroundBanner {
  body: string;
  target: NotificationTarget;
  title: string;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

function getNotificationErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = typeof error.code === 'string' ? error.code : '';
    if (code.includes('network')) return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
    if (code.includes('permission') || code.includes('blocked')) {
      return 'Bildirim izni kapalı. Sistem ayarlarından izin verebilirsin.';
    }
  }
  return 'Bildirim ayarları güncellenemedi. Lütfen tekrar deneyin.';
}

function NotificationBanner({
  banner,
  onClose,
  onOpen,
}: {
  banner: ForegroundBanner;
  onClose: () => void;
  onOpen: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${banner.title}. ${banner.body}`}
      accessibilityHint="Profili açmak için dokunun"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: radii.md,
          gap: spacing.md,
          left: spacing.md,
          opacity: pressed ? 0.94 : 1,
          padding: spacing.md,
          right: spacing.md,
          top: insets.top + spacing.sm,
        },
      ]}
    >
      <View style={{ alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primarySubtle, borderRadius: radii.sm, height: 40, justifyContent: 'center', width: 40 }}>
        <Ionicons name="people-outline" size={21} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText weight="800">{banner.title}</AppText>
        <AppText color="muted" variant="caption" numberOfLines={2}>{banner.body}</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bildirimi kapat"
        hitSlop={12}
        onPress={(event) => {
          event.stopPropagation();
          onClose();
        }}
        style={{ alignItems: 'center', height: 40, justifyContent: 'center', width: 40 }}
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { session, status: authStatus } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [preferences, setPreferences] = useState(defaultNotificationPreferences);
  const [permission, setPermission] = useState<NotificationPermissionState>('not-determined');
  const [status, setStatus] = useState<NotificationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<ForegroundBanner | null>(null);
  const preferencesRef = useRef(preferences);
  const userIdRef = useRef<string | null>(null);
  const writeQueueRef = useRef(Promise.resolve());
  const handledEventIdsRef = useRef(new Set<string>());

  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  useEffect(() => { userIdRef.current = session?.userId ?? null; }, [session?.userId]);

  const openTarget = useCallback((target: NotificationTarget) => {
    setBanner(null);
    router.push({ pathname: '/devre/[userId]', params: { userId: target.profileUserId } });
  }, [router]);

  const readTarget = useCallback((message: RemoteMessage): NotificationTarget | null => {
    const target = parseNotificationTarget(message.data);
    if (!target || handledEventIdsRef.current.has(target.eventId)) return null;
    handledEventIdsRef.current.add(target.eventId);
    if (handledEventIdsRef.current.size > 100) {
      const oldestEventId = handledEventIdsRef.current.values().next().value;
      if (typeof oldestEventId === 'string') handledEventIdsRef.current.delete(oldestEventId);
    }
    return target;
  }, []);

  useEffect(() => {
    let active = true;
    if (authStatus !== 'authenticated' || !session) {
      queueMicrotask(() => {
        if (!active) return;
        setPreferences(defaultNotificationPreferences);
        setPermission('not-determined');
        setStatus('idle');
        setBanner(null);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (!active) return;
      setStatus('loading');
      setError(null);
    });
    Promise.all([
      fetchNotificationPreferences(session.userId),
      getNotificationPermissionState(),
    ]).then(async ([nextPreferences, nextPermission]) => {
      if (!active) return;
      setPreferences(nextPreferences);
      setPermission(nextPermission);
      setStatus('ready');
      if (nextPreferences.enabled && nextPermission === 'authorized') {
        await registerCurrentNotificationDevice(session.userId);
      }
    }).catch((caughtError: unknown) => {
      if (!active) return;
      setError(getNotificationErrorMessage(caughtError));
      setStatus('ready');
    });
    return () => { active = false; };
  }, [authStatus, session]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !session) return undefined;
    const handleOpenedMessage = (message: RemoteMessage) => {
      const target = readTarget(message);
      if (target) openTarget(target);
    };
    const unsubscribeOpened = subscribeToOpenedNotifications(handleOpenedMessage);
    const unsubscribeForeground = subscribeToForegroundNotifications((message) => {
      const target = readTarget(message);
      if (!target || pathname === `/devre/${target.profileUserId}`) return;
      setBanner({
        target,
        title: message.notification?.title ?? 'Yeni bir devren var',
        body: message.notification?.body ?? 'Keşfet bölümünde yeni devreni görebilirsin.',
      });
    });
    const unsubscribeTokenRefresh = subscribeToNotificationTokenRefresh((token) => {
      const uid = userIdRef.current;
      if (!uid || !preferencesRef.current.enabled) return;
      void registerCurrentNotificationDevice(uid, token).catch(() => undefined);
    });
    void getInitialOpenedNotification().then((message) => {
      if (message) handleOpenedMessage(message);
    }).catch(() => undefined);
    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
      unsubscribeTokenRefresh();
    };
  }, [authStatus, openTarget, pathname, readTarget, session]);

  useEffect(() => {
    if (!banner) return undefined;
    const timeout = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(timeout);
  }, [banner]);

  const persistPreferences = useCallback(async (
    nextPreferences: NotificationPreferences,
    previousPreferences: NotificationPreferences,
  ): Promise<void> => {
    const uid = userIdRef.current;
    if (!uid) return;
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    setStatus('saving');
    setError(null);
    const write = writeQueueRef.current
      .catch(() => undefined)
      .then(() => saveNotificationPreferences(uid, nextPreferences));
    writeQueueRef.current = write.catch(() => undefined);
    try {
      await write;
    } catch (caughtError: unknown) {
      if (preferencesRef.current === nextPreferences) {
        preferencesRef.current = previousPreferences;
        setPreferences(previousPreferences);
      }
      setError(getNotificationErrorMessage(caughtError));
      throw caughtError;
    } finally {
      if (preferencesRef.current === nextPreferences) setStatus('ready');
    }
  }, []);

  const setEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    const uid = userIdRef.current;
    if (!uid || preferencesRef.current.enabled === enabled) return;
    const previousPreferences = preferencesRef.current;
    const nextPreferences = { ...previousPreferences, enabled };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    setError(null);
    if (enabled) {
      setStatus('saving');
      const nextPermission = await requestNotificationPermission().catch((caughtError: unknown) => {
        preferencesRef.current = previousPreferences;
        setPreferences(previousPreferences);
        setStatus('ready');
        setError(getNotificationErrorMessage(caughtError));
        return 'denied' as const;
      });
      setPermission(nextPermission);
      if (nextPermission !== 'authorized') {
        preferencesRef.current = previousPreferences;
        setPreferences(previousPreferences);
        setStatus('ready');
        setError('Bildirim izni kapalı. Sistem ayarlarından izin verebilirsin.');
        return;
      }
    }
    try {
      await persistPreferences(nextPreferences, previousPreferences);
      if (enabled) {
        try {
          await registerCurrentNotificationDevice(uid);
        } catch (caughtError: unknown) {
          await persistPreferences(previousPreferences, nextPreferences);
          await deleteCurrentNotificationDevice(uid).catch(() => undefined);
          throw caughtError;
        }
      } else {
        await deleteCurrentNotificationDevice(uid);
      }
    } catch (caughtError: unknown) {
      setError(getNotificationErrorMessage(caughtError));
    } finally {
      setStatus('ready');
    }
  }, [persistPreferences]);

  const setDiscoveryPreference = useCallback(async (
    key: keyof DiscoveryNotificationPreferences,
    enabled: boolean,
  ): Promise<void> => {
    const previousPreferences = preferencesRef.current;
    if (previousPreferences.discovery[key] === enabled) return;
    const nextPreferences = {
      ...previousPreferences,
      discovery: { ...previousPreferences.discovery, [key]: enabled },
    };
    try {
      await persistPreferences(nextPreferences, previousPreferences);
    } catch {
      // The shared persistence path already restored state and exposed the error.
    }
  }, [persistPreferences]);

  const refreshPermission = useCallback(async (): Promise<void> => {
    try {
      const nextPermission = await getNotificationPermissionState();
      setPermission(nextPermission);
      setError(null);
      if (nextPermission === 'authorized' && preferencesRef.current.enabled && userIdRef.current) {
        await registerCurrentNotificationDevice(userIdRef.current);
      }
    } catch (caughtError: unknown) {
      setError(getNotificationErrorMessage(caughtError));
    }
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    error,
    permission,
    preferences,
    refreshPermission,
    setDiscoveryPreference,
    setEnabled,
    status,
  }), [error, permission, preferences, refreshPermission, setDiscoveryPreference, setEnabled, status]);

  return (
    <NotificationContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {banner ? (
          <NotificationBanner
            banner={banner}
            onClose={() => setBanner(null)}
            onOpen={() => openTarget(banner.target)}
          />
        ) : null}
      </View>
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    alignItems: 'center',
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    minHeight: 72,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    zIndex: 100,
  },
});