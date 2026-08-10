import type { ConfigContext, ExpoConfig } from 'expo/config';

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
    googleServicesFile:
      process.env.FIREBASE_ANDROID_CONFIG_FILE ??
      './config/firebase/development/google-services.json',
  },

  ios: {
    ...config.ios,
    entitlements: {
      ...config.ios?.entitlements,
      'aps-environment': process.env.EXPO_PUBLIC_APP_ENV === 'development'
        ? 'development'
        : 'production',
    },
    infoPlist: {
      ...config.ios?.infoPlist,
      UIBackgroundModes: includeInfoPlistString(
        config.ios?.infoPlist?.UIBackgroundModes,
        'remote-notification',
      ),
    },
    googleServicesFile:
      process.env.FIREBASE_IOS_CONFIG_FILE ??
      './config/firebase/development/GoogleService-Info.plist',
  },
});
