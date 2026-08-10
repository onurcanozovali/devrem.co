import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { writeAsStringAsync } from 'expo-file-system/legacy';
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  hasPermission,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  setAutoInitEnabled,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

import {
  defaultNotificationPreferences,
  parseNotificationPreferences,
} from '@/features/notifications/services/notificationDomain';
import type {
  NotificationPermissionState,
  NotificationPreferences,
} from '@/features/notifications/types/notifications';
import { getFirebaseApp } from './app';

const installationFileName = 'devrem-notification-installation-id.txt';

function getNotificationPreferencesReference(uid: string) {
  return doc(getFirestore(getFirebaseApp()), 'users', uid, 'notificationPreferences', 'main');
}

function createInstallationId(): string {
  const randomPart = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `installation-${Date.now().toString(36)}-${randomPart}`;
}

async function getInstallationId(): Promise<string> {
  const file = new File(Paths.document, installationFileName);
  try {
    if (file.exists) {
      const storedValue = file.textSync().trim();
      if (/^installation-[a-z0-9-]{12,80}$/.test(storedValue)) return storedValue;
    }
  } catch {
    // A fresh ID below is safe; stale registrations expire server-side.
  }
  const installationId = createInstallationId();
  await writeAsStringAsync(file.uri, installationId);
  return installationId;
}

function readExistingInstallationId(): string | null {
  try {
    const file = new File(Paths.document, installationFileName);
    if (!file.exists) return null;
    const storedValue = file.textSync().trim();
    return /^installation-[a-z0-9-]{12,80}$/.test(storedValue) ? storedValue : null;
  } catch {
    return null;
  }
}

function isAuthorized(status: number): boolean {
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

function mapAuthorizationStatus(status: number): NotificationPermissionState {
  if (isAuthorized(status)) return 'authorized';
  return status === AuthorizationStatus.NOT_DETERMINED ? 'not-determined' : 'denied';
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return 'authorized';
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return granted ? 'authorized' : 'not-determined';
  }
  return mapAuthorizationStatus(await hasPermission(getMessaging(getFirebaseApp())));
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return 'authorized';
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED ? 'authorized' : 'denied';
  }
  return mapAuthorizationStatus(await requestPermission(getMessaging(getFirebaseApp()), {
    alert: true,
    badge: true,
    sound: true,
  }));
}

export async function fetchNotificationPreferences(uid: string): Promise<NotificationPreferences> {
  const snapshot = await getDoc(getNotificationPreferencesReference(uid));
  if (!snapshot.exists()) return defaultNotificationPreferences;
  return parseNotificationPreferences(snapshot.data()) ?? defaultNotificationPreferences;
}

export async function saveNotificationPreferences(
  uid: string,
  preferences: NotificationPreferences,
): Promise<void> {
  const reference = getNotificationPreferencesReference(uid);
  await runTransaction(getFirestore(getFirebaseApp()), async (transaction) => {
    const snapshot = await transaction.get(reference);
    transaction.set(reference, {
      ...preferences,
      createdAt: snapshot.exists() && snapshot.get('createdAt') instanceof Timestamp
        ? snapshot.get('createdAt')
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function registerCurrentNotificationDevice(uid: string, token?: string): Promise<void> {
  const messaging = getMessaging(getFirebaseApp());
  await setAutoInitEnabled(messaging, true);
  await registerDeviceForRemoteMessages(messaging);
  const [installationId, registrationToken] = await Promise.all([
    getInstallationId(),
    token ? Promise.resolve(token) : getToken(messaging),
  ]);
  const database = getFirestore(getFirebaseApp());
  const reference = doc(database, 'users', uid, 'devices', installationId);
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    transaction.set(reference, {
      installationId,
      token: registrationToken,
      platform: Platform.OS,
      enabled: true,
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      createdAt: snapshot.exists() && snapshot.get('createdAt') instanceof Timestamp
        ? snapshot.get('createdAt')
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
  });
}

export async function deleteCurrentNotificationDevice(uid: string): Promise<void> {
  await setAutoInitEnabled(getMessaging(getFirebaseApp()), false);
  const installationId = readExistingInstallationId();
  if (!installationId) return;
  await deleteDoc(doc(getFirestore(getFirebaseApp()), 'users', uid, 'devices', installationId));
}

export function subscribeToForegroundNotifications(
  listener: (message: RemoteMessage) => void,
): () => void {
  return onMessage(getMessaging(getFirebaseApp()), listener);
}

export function subscribeToOpenedNotifications(
  listener: (message: RemoteMessage) => void,
): () => void {
  return onNotificationOpenedApp(getMessaging(getFirebaseApp()), listener);
}

export function subscribeToNotificationTokenRefresh(
  listener: (token: string) => void,
): () => void {
  return onTokenRefresh(getMessaging(getFirebaseApp()), listener);
}

export async function getInitialOpenedNotification(): Promise<RemoteMessage | null> {
  return getInitialNotification(getMessaging(getFirebaseApp()));
}