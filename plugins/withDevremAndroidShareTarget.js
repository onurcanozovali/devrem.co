const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SEND_MULTIPLE = 'android.intent.action.SEND_MULTIPLE';

module.exports = function withDevremAndroidShareTarget(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(nextConfig.modResults);
    const filters = mainActivity['intent-filter'] ?? [];
    mainActivity['intent-filter'] = filters.filter((filter) => {
      const actions = filter.action ?? [];
      return !actions.some((action) => action.$?.['android:name'] === SEND_MULTIPLE);
    });
    return nextConfig;
  });
};
