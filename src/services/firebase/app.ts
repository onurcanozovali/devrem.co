import { getApp, type FirebaseApp } from '@react-native-firebase/app';

import { getAppConfig } from '@/config/env';

class FirebaseConfigurationError extends Error {
  readonly code = 'auth/app-not-authorized';
}

/**
 * Returns the native default Firebase app configured by the platform files.
 * The project ID check prevents an environment from using another environment's native app.
 */
export function getFirebaseApp(): FirebaseApp {
  const app = getApp();
  const { environment, firebase } = getAppConfig();

  if (app.options.projectId !== firebase.projectId) {
    throw new FirebaseConfigurationError(
      `Firebase project mismatch for the ${environment} environment. Check the native Firebase configuration file.`,
    );
  }

  return app;
}
