import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';

export default function IndexRoute() {
  const { status } = useAuth();
  const { status: profileStatus } = useProfile();

  if (status !== 'authenticated') return <Redirect href="/phone" />;
  if (profileStatus === 'complete') return <Redirect href="/(tabs)" />;
  return <Redirect href="/onboarding" />;
}
