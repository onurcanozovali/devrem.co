import type { ConfigContext, ExpoConfig } from 'expo/config';
import legalEntity from './src/features/legal/legalEntity.json';

const easBuildProfile = process.env.EAS_BUILD_PROFILE?.trim();
const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV?.trim();
const isReleaseBuild = easBuildProfile === 'production'
  || easBuildProfile === 'preview'
  || appEnvironment === 'production'
  || (process.env.NODE_ENV === 'production' && appEnvironment !== 'development');

function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && /FILL_BEFORE_PRODUCTION|^FILL_/i.test(value.trim());
}

function requireReleaseValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Release configuration is incomplete: ${name} is required.`);
  return value;
}

if (isReleaseBuild && Object.values(legalEntity).some(isPlaceholder)) {
  throw new Error('Release legal entity configuration is incomplete. Fill src/features/legal/legalEntity.json before release.');
}

const androidFirebaseConfig = isReleaseBuild
  ? requireReleaseValue('FIREBASE_ANDROID_CONFIG_FILE')
  : process.env.FIREBASE_ANDROID_CONFIG_FILE ?? './config/firebase/development/google-services.json';
const iosFirebaseConfig = isReleaseBuild
  ? requireReleaseValue('FIREBASE_IOS_CONFIG_FILE')
  : process.env.FIREBASE_IOS_CONFIG_FILE ?? './config/firebase/development/GoogleService-Info.plist';

if (isReleaseBuild) {
  for (const name of [
    'EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'EXPO_PUBLIC_FIREBASE_APP_ID',
  ]) requireReleaseValue(name);
}

function includeString(values: string[] | undefined, value: string): string[] {
  return values?.includes(value) ? values : [...(values ?? []), value];
}

function includeInfoPlistString(values: unknown, value: string): string[] {
  const strings = Array.isArray(values)
    ? values.filter((item): item is string => typeof item === 'string')
    : [];
  return includeString(strings, value);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Devrem',
  slug: config.slug ?? 'devrem',

  android: {
    ...config.android,
    permissions: includeString(config.android?.permissions, 'android.permission.POST_NOTIFICATIONS'),
    googleServicesFile: androidFirebaseConfig,
  },

  ios: {
    ...config.ios,
    entitlements: {
      ...config.ios?.entitlements,
      'aps-environment': isReleaseBuild ? 'production' : 'development',
    },
    infoPlist: {
      ...config.ios?.infoPlist,
      UIBackgroundModes: includeInfoPlistString(
        config.ios?.infoPlist?.UIBackgroundModes,
        'remote-notification',
      ),
    },
    googleServicesFile: iosFirebaseConfig,
  },
});
