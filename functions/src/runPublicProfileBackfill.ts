import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { backfillPublicProfiles } from './publicProfileBackfill.js';

initializeApp();

backfillPublicProfiles(getFirestore())
  .then((count) => {
    console.info(`Synchronized ${count} public profiles.`);
  })
  .catch((error: unknown) => {
    console.error('Public profile backfill failed.', error);
    process.exitCode = 1;
  });