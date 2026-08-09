import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  clearDiscoveryProfiles,
  resolveDiscoverySeedContext,
  verifyDiscoveryQuery,
  seedDiscoveryProfiles,
  verifyDiscoveryProfiles,
} from './discoverySeed.js';

interface FirebaseCliAccount {
  tokens: { refresh_token?: string };
}

interface FirebaseCliAuth {
  getGlobalDefaultAccount(): FirebaseCliAccount | undefined;
}

interface FirebaseCliApi {
  clientId(): string;
  clientSecret(): string;
}

const developmentProjectId = 'devrem-d985b';
const developmentStorageBucket = 'devrem-d985b.firebasestorage.app';
const action = process.argv[2];
if (action !== 'seed' && action !== 'clear' && action !== 'verify') {
  throw new Error('Expected seed, verify, or clear action.');
}

for (const configuredProjectId of [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT]) {
  if (configuredProjectId && configuredProjectId !== developmentProjectId) {
    throw new Error(`Refusing to seed configured project ${configuredProjectId}.`);
  }
}

function createTemporaryFirebaseCliAdc(): string {
  const require = createRequire(__filename);
  const auth = require('firebase-tools/lib/auth') as FirebaseCliAuth;
  const api = require('firebase-tools/lib/api') as FirebaseCliApi;
  const refreshToken = auth.getGlobalDefaultAccount()?.tokens.refresh_token;
  if (!refreshToken) {
    throw new Error('Firebase CLI login is required. Run pnpm exec firebase login first.');
  }
  const credentialPath = join(tmpdir(), `devrem-firebase-adc-${randomUUID()}.json`);
  writeFileSync(credentialPath, JSON.stringify({
    type: 'authorized_user',
    client_id: api.clientId(),
    client_secret: api.clientSecret(),
    refresh_token: refreshToken,
    quota_project_id: developmentProjectId,
  }), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return credentialPath;
}

const temporaryCredentialPath = createTemporaryFirebaseCliAdc();
process.env.GOOGLE_APPLICATION_CREDENTIALS = temporaryCredentialPath;
let app;
try {
  app = initializeApp({
    projectId: developmentProjectId,
    storageBucket: developmentStorageBucket,
    credential: applicationDefault(),
  });
} catch (error) {
  rmSync(temporaryCredentialPath, { force: true });
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  throw error;
}
const database = getFirestore();
const bucket = getStorage().bucket();

async function verifySeed(): Promise<Awaited<ReturnType<typeof verifyDiscoveryProfiles>>> {
  const verified = await verifyDiscoveryProfiles(database);
  const avatarProfiles = verified.filter((profile) => profile.photoPath !== null);
  const avatarResults = await Promise.all(avatarProfiles.map((profile) => (
    bucket.file(profile.photoPath!).exists()
  )));
  if (avatarProfiles.length !== 4 || avatarResults.some(([exists]) => !exists)) {
    throw new Error('Expected all 4 synthetic discovery avatars to exist.');
  }
  const eligibleSeedCount = await verifyDiscoveryQuery(database);
  console.info(`Verified the indexed discovery query returns ${eligibleSeedCount} eligible seed profiles.`);
  return verified;
}

async function run(): Promise<void> {
  if (action === 'verify') {
    const verified = await verifySeed();
    console.info(`Verified ${verified.length} discovery profiles and 4 avatars in ${developmentProjectId}.`);
    for (const profile of verified) console.info(`${profile.id}: ${profile.firstName}`);
    return;
  }
  if (action === 'clear') {
    const count = await clearDiscoveryProfiles(database, bucket);
    console.info(`Cleared ${count} discovery profiles from ${developmentProjectId}.`);
    return;
  }

  const context = await resolveDiscoverySeedContext(database);
  const count = await seedDiscoveryProfiles(database, bucket, context);
  const verified = await verifySeed();
  console.info(`Seeded and verified ${count} discovery profiles in ${developmentProjectId}.`);
  console.info(`Context: ${context.militaryPeriodMonth}/${context.militaryPeriodYear}, destination ${context.militaryCity}, residence ${context.residenceCity}, departure ${context.departureCity}.`);
  for (const profile of verified) console.info(`${profile.id}: ${profile.firstName}`);
}

run().catch((error: unknown) => {
    console.error(`Discovery ${action} failed.`, error);
    process.exitCode = 1;
  }).finally(async () => {
    try {
      await deleteApp(app);
    } finally {
      rmSync(temporaryCredentialPath, { force: true });
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  });