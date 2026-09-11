import { Redirect } from 'expo-router';
// The `Tabs` re-exported from the `expo-router` root is deprecated in this
// SDK version in favor of `expo-router/js-tabs` (see node_modules/expo-router
// /build/exports.d.ts) — same API, non-deprecated import path.
import { Tabs } from 'expo-router/js-tabs';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // A real `Tabs` navigator (rather than the previous `Slot`-per-screen
  // setup) so each tab's screen stays mounted when you switch away and
  // back — search text, the selected filter chip, and scroll position all
  // persist instead of being torn down and re-fetched every switch. The
  // `tabBar` render prop keeps the existing floating-pill visual design
  // (see components/floating-tab-bar.tsx) instead of the default bar.
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Own' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
    </Tabs>
  );
}
