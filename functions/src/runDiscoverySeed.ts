import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { clearDiscoveryProfiles, seedDiscoveryProfiles } from './discoverySeed.js';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredInteger(name: string, minimum: number, maximum: number): number {
  const value = Number(requiredEnvironment(name));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

const action = process.argv[2];
if (action !== 'seed' && action !== 'clear') throw new Error('Expected seed or clear action.');

const projectId = requiredEnvironment('DEVREM_DISCOVERY_PROJECT_ID');
const confirmation = requiredEnvironment('DEVREM_DISCOVERY_SEED_CONFIRM');
if (process.env.DEVREM_DISCOVERY_SEED_ENV !== 'development') {
  throw new Error('DEVREM_DISCOVERY_SEED_ENV must be development.');
}
if (confirmation !== `seed:${projectId}`) {
  throw new Error('DEVREM_DISCOVERY_SEED_CONFIRM must exactly match seed:<project-id>.');
}
if (/prod(uction)?/i.test(projectId)) throw new Error('Production-looking project IDs are not allowed.');

const storageBucket = requiredEnvironment('DEVREM_DISCOVERY_STORAGE_BUCKET');
initializeApp({ projectId, storageBucket });
const database = getFirestore();
const bucket = getStorage().bucket();

const operation = action === 'seed'
  ? seedDiscoveryProfiles(database, bucket, {
      currentUserId: requiredEnvironment('DEVREM_DISCOVERY_CURRENT_UID'),
      residenceCity: requiredInteger('DEVREM_DISCOVERY_RESIDENCE_CITY', 1, 81),
      departureCity: requiredInteger('DEVREM_DISCOVERY_DEPARTURE_CITY', 1, 81),
      militaryCity: requiredInteger('DEVREM_DISCOVERY_MILITARY_CITY', 1, 81),
      militaryPeriodYear: requiredInteger('DEVREM_DISCOVERY_PERIOD_YEAR', 2020, 2100),
      militaryPeriodMonth: requiredInteger('DEVREM_DISCOVERY_PERIOD_MONTH', 1, 12),
      militaryUnit: requiredEnvironment('DEVREM_DISCOVERY_UNIT'),
    })
  : clearDiscoveryProfiles(database, bucket);

operation
  .then((count) => console.info(`${action === 'seed' ? 'Seeded' : 'Cleared'} ${count} discovery profiles.`))
  .catch((error: unknown) => {
    console.error(`Discovery ${action} failed.`, error);
    process.exitCode = 1;
  });