import { Redirect, Slot } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // The floating pill tab bar is drawn per-screen (see components/floating-tab-bar.tsx)
  // rather than by a navigator, matching the design's absolutely-positioned overlay.
  return <Slot />;
}
