import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <AppTabs />;
}
