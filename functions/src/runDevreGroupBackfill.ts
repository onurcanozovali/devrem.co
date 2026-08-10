import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { backfillDevreGroups } from './devreGroupBackfill.js';

const developmentProjectId = 'devrem-d985b';
const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (
  projectId !== developmentProjectId
  || process.env.DEVREM_GROUP_BACKFILL_CONFIRM !== developmentProjectId
) {
  throw new Error(`Set GCLOUD_PROJECT and DEVREM_GROUP_BACKFILL_CONFIRM to ${developmentProjectId}.`);
}

initializeApp({ projectId, credential: applicationDefault() });
backfillDevreGroups(getFirestore())
  .then((count) => console.info(`Ensured ${count} Devre group memberships in ${projectId}.`))
  .catch((error: unknown) => {
    console.error('Devre group backfill failed.', error);
    process.exitCode = 1;
  });
