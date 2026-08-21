import type { ConfigContext, ExpoConfig } from 'expo/config';
import { readFileSync } from 'node:fs';
import legalEntity from './src/features/legal/legalEntity.json';

const productionFirebaseProjectId = 'devrem-d985b';
const productionApplicationId = 'com.devrem.app';
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

function requirePlistValue(contents: string, key: string): string {
  const match = contents.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`));
  if (!match?.[1]) throw new Error(`Release iOS Firebase configuration is missing ${key}.`);
  return match[1].trim();
}

function validateReleaseNativeFirebase(androidPath: string, iosPath: string): void {
  let androidConfig: { client?: { client_info?: { android_client_info?: { package_name?: string } } }[]; project_info?: { project_id?: string } };
  let iosConfig: string;
  try {
    androidConfig = JSON.parse(readFileSync(androidPath, 'utf8')) as typeof androidConfig;
    iosConfig = readFileSync(iosPath, 'utf8');
  } catch {
    throw new Error('Release native Firebase configuration files are missing or unreadable.');
  }
  if (androidConfig.project_info?.project_id !== productionFirebaseProjectId
    || androidConfig.client?.[0]?.client_info?.android_client_info?.package_name !== productionApplicationId) {
    throw new Error('Release Android Firebase configuration does not match devrem-d985b / com.devrem.app.');
  }
  if (requirePlistValue(iosConfig, 'PROJECT_ID') !== productionFirebaseProjectId
    || requirePlistValue(iosConfig, 'BUNDLE_ID') !== productionApplicationId) {
    throw new Error('Release iOS Firebase configuration does not match devrem-d985b / com.devrem.app.');
  }
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
  if (requireReleaseValue('EXPO_PUBLIC_FIREBASE_PROJECT_ID') !== productionFirebaseProjectId) {
    throw new Error(`Release Firebase project must be ${productionFirebaseProjectId}.`);
  }
  validateReleaseNativeFirebase(androidFirebaseConfig, iosFirebaseConfig);
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
