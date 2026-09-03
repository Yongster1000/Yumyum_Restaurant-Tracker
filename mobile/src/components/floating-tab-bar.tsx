import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CompassIcon, UtensilsIcon } from '@/components/icons';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

type Tab = 'own' | 'discover';

const TABS: { key: Tab; href: '/(tabs)' | '/(tabs)/discover'; label: string; Icon: typeof UtensilsIcon }[] = [
  { key: 'own', href: '/(tabs)', label: 'Own', Icon: UtensilsIcon },
  { key: 'discover', href: '/(tabs)/discover', label: 'Discover', Icon: CompassIcon },
];

export function FloatingTabBar({ active }: { active: Tab }) {
  return (
    <View style={styles.bar}>
      {TABS.map(({ key, href, label, Icon }) => {
        const isActive = key === active;
        return (
          <Link key={key} href={href} asChild>
            <Pressable style={StyleSheet.flatten([styles.tab, isActive && styles.tabActive])}>
              <Icon size={22} color={isActive ? Colors.accent : Colors.neutral600} strokeWidth={isActive ? 2.75 : 2.25} />
              <ThemedText
                variant={isActive ? 'bodyBold' : 'bodySemibold'}
                color={isActive ? 'accent' : 'neutral600'}
                style={styles.label}>
                {label}
              </ThemedText>
            </Pressable>
          </Link>
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
