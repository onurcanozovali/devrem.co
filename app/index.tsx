import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';

export default function IndexRoute() {
  const { status } = useAuth();
  return <Redirect href={status === 'authenticated' ? '/(tabs)' : '/phone'} />;
}
