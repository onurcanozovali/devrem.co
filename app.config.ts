import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Devrem',
  slug: config.slug ?? 'devrem',
  android: {
    ...config.android,
    googleServicesFile:
      process.env.FIREBASE_ANDROID_CONFIG_FILE ?? './config/firebase/development/google-services.json',
  },
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.FIREBASE_IOS_CONFIG_FILE ?? './config/firebase/development/GoogleService-Info.plist',
  },
});
