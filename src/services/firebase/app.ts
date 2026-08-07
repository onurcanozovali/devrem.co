import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import { getAppConfig } from '@/config/env';

/**
 * Returns the single Firebase client app for the current environment.
 * Initialization is lazy so Phase 1 screens can run before Firebase is used.
 */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();

  const { firebase } = getAppConfig();
  return initializeApp(firebase);
}
