import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { getAppConfig } from '@/config/env';

export default function IndexRoute() {
  const { status, legalStatus } = useAuth();
  const { status: profileStatus } = useProfile();

  if (status !== 'authenticated') return <Redirect href="/phone" />;
  if (getAppConfig().environment === 'production' && legalStatus === 'required') return <Redirect href="/legal-update" />;
  if (profileStatus === 'complete') return <Redirect href="/(tabs)" />;
  return <Redirect href="/onboarding" />;
}
