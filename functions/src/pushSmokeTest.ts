import { randomUUID } from 'node:crypto';

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

const registrationFreshnessDays = 30;

interface SmokeTestDevice {
  token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePushSmokeTestUid(arguments_: string[]): string {
  if (arguments_.length !== 2 || arguments_[0] !== '--uid') {
    throw new Error('Usage: pnpm test:push --uid <firebaseUid>');
  }
  const uid = arguments_[1]?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new Error('A valid explicit Firebase UID is required.');
  }
  return uid;
}

function assertNotificationsEnabled(value: unknown): void {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || !isRecord(value.discovery)) {
    throw new Error('Notification preferences are missing or malformed; no test notification was sent.');
  }
  if (!value.enabled) {
    throw new Error('Notifications are disabled for this user; enable the master notification setting first.');
  }
  if (value.discovery.newDevre !== true) {
    throw new Error('New-Devre notifications are disabled for this user; enable that preference first.');
  }
}

function parseActiveAndroidDevice(value: unknown, cutoffMillis: number): SmokeTestDevice | null {
  if (!isRecord(value)) return null;
  if (
    value.enabled !== true
    || value.platform !== 'android'
    || typeof value.token !== 'string'
    || value.token.trim().length === 0
    || !(value.lastSeenAt instanceof Timestamp)
    || value.lastSeenAt.toMillis() < cutoffMillis
  ) return null;
  return { token: value.token };
}

export async function sendPushSmokeTest(input: {
  database: Firestore;
  messaging: Messaging;
  recipientUid: string;
}): Promise<{ activeDeviceCount: number; failureCount: number; successCount: number }> {
  const { database, messaging, recipientUid } = input;
  const [preferencesSnapshot, devicesSnapshot] = await Promise.all([
    database.doc(`users/${recipientUid}/notificationPreferences/main`).get(),
    database.collection(`users/${recipientUid}/devices`).get(),
  ]);

  if (!preferencesSnapshot.exists) {
    throw new Error('Notification preferences do not exist for this user; no test notification was sent.');
  }
  assertNotificationsEnabled(preferencesSnapshot.data());

  const cutoffMillis = Date.now() - registrationFreshnessDays * 24 * 60 * 60 * 1000;
  const tokens = new Set<string>();
  for (const documentSnapshot of devicesSnapshot.docs) {
    const device = parseActiveAndroidDevice(documentSnapshot.data(), cutoffMillis);
    if (device) tokens.add(device.token);
  }
  if (tokens.size === 0) {
    throw new Error('No active Android device registration was found; no test notification was sent.');
  }
  if (tokens.size > 500) {
    throw new Error('More than 500 active Android tokens were found; refusing an unexpectedly broad smoke test.');
  }

  const eventId = `test-push-${randomUUID()}`;
  let response;
  try {
    response = await messaging.sendEachForMulticast({
      tokens: [...tokens],
      notification: {
        title: 'Devrem bildirim testi',
        body: 'Bildirimler hazır. Devreni Bul ekranını açmak için dokun.',
      },
      data: {
        type: 'testDiscovery',
        target: 'matching',
        eventId,
      },
      android: { priority: 'high' },
    });
  } catch (error: unknown) {
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'unknown';
    throw new Error(`FCM smoke-test request failed (${code}); no token was logged.`);
  }

  const failureCodes = [...new Set(response.responses.flatMap((result) => (
    result.success || !result.error?.code ? [] : [result.error.code]
  )))];
  console.info('Push smoke test completed.', {
    recipientUid,
    activeAndroidDeviceCount: tokens.size,
    successCount: response.successCount,
    failureCount: response.failureCount,
    failureCodes,
    eventId,
  });
  return {
    activeDeviceCount: tokens.size,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}
