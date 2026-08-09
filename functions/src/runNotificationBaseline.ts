import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { baselineDiscoveryNotificationMemberships } from './notificationBaseline.js';

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId || process.env.DEVREM_NOTIFICATION_BASELINE_CONFIRM !== projectId) {
  throw new Error('Set DEVREM_NOTIFICATION_BASELINE_CONFIRM to the target Firebase project ID.');
}

initializeApp({ projectId, credential: applicationDefault() });

baselineDiscoveryNotificationMemberships(getFirestore())
  .then((count) => {
    console.info(`Baselined ${count} discovery notification memberships in ${projectId}.`);
  })
  .catch((error: unknown) => {
    console.error('Discovery notification baseline failed; notification delivery remains disabled.', error);
    process.exitCode = 1;
  });