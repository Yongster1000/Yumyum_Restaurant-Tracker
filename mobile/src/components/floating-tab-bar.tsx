// `Tabs`/`BottomTabBarProps` moved to `expo-router/js-tabs` — the `expo-router`
// root export is deprecated in this SDK version (see exports.d.ts).
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { CompassIcon, UtensilsIcon } from '@/components/icons';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

// Maps each (tabs) route name to the tab bar's icon + label. Keyed by route
// name (the screen's file name under app/(tabs)) rather than a hand-picked
// `active` prop, since this now renders as the `Tabs` navigator's `tabBar`
// and gets the route list from React Navigation itself.
const TAB_META: Record<string, { label: string; Icon: typeof UtensilsIcon }> = {
  index: { label: 'Own', Icon: UtensilsIcon },
  discover: { label: 'Discover', Icon: CompassIcon },
};

// Custom `tabBar` render prop for `Tabs` (see app/(tabs)/_layout.tsx),
// reproducing the same floating pill visual design this used to have as a
// per-screen overlay — but now driven by the navigator's own state, so
// switching tabs no longer requires each screen to render (and know about)
// the bar itself.
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // `styles.bar.bottom` is tuned against a zero-inset device; on Android's
  // 3-button/gesture nav (or the iPhone home indicator) that raw offset
  // isn't enough to clear the system bar, so add the device's own inset on
  // top of it rather than replacing it.
  return (
    <View style={[styles.bar, { bottom: styles.bar.bottom + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;

        const isActive = state.index === index;
        const { Icon, label } = meta;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={isActive ? { selected: true } : {}}
            accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? label}
            style={StyleSheet.flatten([styles.tab, isActive && styles.tabActive])}>
            <Icon size={22} color={isActive ? Colors.accent : Colors.neutral600} strokeWidth={isActive ? 2.75 : 2.25} />
            <ThemedText
              variant={isActive ? 'bodyBold' : 'bodySemibold'}
              color={isActive ? 'accent' : 'neutral600'}
              style={styles.label}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.space4,
    right: Spacing.space4,
    bottom: 38,
    height: 66,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.space2,
    ...Shadows.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  tabActive: {
    backgroundColor: Colors.accent100,
  },
  label: {
    fontSize: 11,
  },
});
