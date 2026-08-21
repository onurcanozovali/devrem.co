import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DarkThemeScope } from '@/theme/ThemeProvider';

export default function AuthLayout() {
  return (
    <DarkThemeScope>
      <StatusBar style="light" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#101613' }, headerShown: false }} />
    </DarkThemeScope>
  );
}
