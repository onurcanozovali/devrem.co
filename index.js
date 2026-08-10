const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');

setBackgroundMessageHandler(getMessaging(), async () => undefined);

require('expo-router/entry');