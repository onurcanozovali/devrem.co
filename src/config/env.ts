export const appEnvironments = ['development', 'staging', 'production'] as const;

export type AppEnvironment = (typeof appEnvironments)[number];

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface AppConfig {
  environment: AppEnvironment;
  firebase: FirebaseClientConfig;
}

const rawEnvironment = {
  appEnvironment: process.env.EXPO_PUBLIC_APP_ENV,
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const;

function requireValue(name: string, value: string | undefined): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env.local and add the Firebase development app configuration.`);
  }
  return normalizedValue;
}

function validateValue(name: string, value: string, pattern: RegExp, expectation: string): string {
  if (!pattern.test(value)) {
    throw new Error(`Invalid environment variable ${name}: expected ${expectation}.`);
  }
  return value;
}

function parseAppEnvironment(value: string | undefined): AppEnvironment {
  const environment = requireValue('EXPO_PUBLIC_APP_ENV', value);
  switch (environment) {
    case 'development':
    case 'staging':
    case 'production':
      return environment;
    default:
      throw new Error(`Invalid EXPO_PUBLIC_APP_ENV: expected one of ${appEnvironments.join(', ')}.`);
  }
}

export function getAppConfig(): AppConfig {
  const measurementId = rawEnvironment.firebaseMeasurementId?.trim() || undefined;

  return {
    environment: parseAppEnvironment(rawEnvironment.appEnvironment),
    firebase: {
      apiKey: validateValue(
        'EXPO_PUBLIC_FIREBASE_API_KEY',
        requireValue('EXPO_PUBLIC_FIREBASE_API_KEY', rawEnvironment.firebaseApiKey),
        /^[A-Za-z0-9_-]{20,}$/,
        'a Firebase web API key',
      ),
      authDomain: validateValue(
        'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
        requireValue('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', rawEnvironment.firebaseAuthDomain),
        /^[a-z0-9.-]+$/i,
        'a hostname without a protocol',
      ),
      projectId: validateValue(
        'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
        requireValue('EXPO_PUBLIC_FIREBASE_PROJECT_ID', rawEnvironment.firebaseProjectId),
        /^[a-z0-9-]{4,30}$/,
        'a Firebase project ID',
      ),
      storageBucket: validateValue(
        'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
        requireValue('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', rawEnvironment.firebaseStorageBucket),
        /^[a-z0-9._-]+$/i,
        'a Firebase Storage bucket hostname',
      ),
      messagingSenderId: validateValue(
        'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        requireValue('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', rawEnvironment.firebaseMessagingSenderId),
        /^\d+$/,
        'a numeric sender ID',
      ),
      appId: validateValue(
        'EXPO_PUBLIC_FIREBASE_APP_ID',
        requireValue('EXPO_PUBLIC_FIREBASE_APP_ID', rawEnvironment.firebaseAppId),
        /^\d+:[A-Za-z0-9]+:(?:ios|android|web):[A-Za-z0-9]+$/,
        'a Firebase application ID',
      ),
      ...(measurementId ? { measurementId } : {}),
    },
  };
}
