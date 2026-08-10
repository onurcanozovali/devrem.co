import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

import { parsePushSmokeTestUid, sendPushSmokeTest } from './pushSmokeTest.js';

const developmentProjectId = 'devrem-d985b';

async function main(): Promise<void> {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId !== developmentProjectId) {
    throw new Error(`Push smoke tests may run only against ${developmentProjectId}.`);
  }
  const recipientUid = parsePushSmokeTestUid(process.argv.slice(2));
  initializeApp({ projectId, credential: applicationDefault() });
  const result = await sendPushSmokeTest({
    database: getFirestore(),
    messaging: getMessaging(),
    recipientUid,
  });
  if (result.failureCount > 0 || result.successCount !== result.activeDeviceCount) {
    throw new Error('The push smoke test did not reach every active Android device.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Push smoke test failed.');
  process.exitCode = 1;
});
