import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Entry, Place, User } from '@/types/database';

type DiscoverEntry = Entry & { place: Place; user: User };

const EVERYONE_FILTER = 'everyone';

export default function DiscoverScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [entries, setEntries] = useState<DiscoverEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeUserId, setActiveUserId] = useState(EVERYONE_FILTER);

  const loadEntries = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('entries')
      .select('*, place:places(*), user:users(*)')
      .neq('user_id', session.user.id)
      .order('updated_at', { ascending: false });
    if (!error && data) {
      setEntries(data as DiscoverEntry[]);
    }
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries]),
  );

  const userFilters = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of entries) {
      seen.set(entry.user.id, entry.user.display_name);
    }
    return Array.from(seen, ([id, displayName]) => ({ id, displayName }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.place.name.toLowerCase().includes(normalizedQuery) ||
        entry.user.display_name.toLowerCase().includes(normalizedQuery);
      const matchesUser = activeUserId === EVERYONE_FILTER || entry.user.id === activeUserId;
      return matchesQuery && matchesUser;
    });
  }, [entries, query, activeUserId]);

  async function addToOwnList(entry: DiscoverEntry) {
    if (!session) return;
    const { error } = await supabase
      .from('entries')
      .insert({ user_id: session.user.id, place_id: entry.place_id, visited: false });
    if (error) {
      Alert.alert('Could not add place', error.message);
    } else {
      Alert.alert('Added', `${entry.place.name} was added to your list.`);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="title" style={styles.title}>
          Discover
        </ThemedText>

        <TextInput
          placeholder="Search by user or place"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: EVERYONE_FILTER, displayName: 'Everyone' }, ...userFilters]}
          keyExtractor={(user) => user.id}
          contentContainerStyle={styles.chipRow}
          style={styles.chipList}
          renderItem={({ item: user }) => (
            <Pressable onPress={() => setActiveUserId(user.id)}>
              <ThemedView
                type={user.id === activeUserId ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.chip}>
                <ThemedText type="small">{user.displayName}</ThemedText>
              </ThemedView>
            </Pressable>
          )}
        />

        <FlatList
          data={filteredEntries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={loadEntries}
          ListEmptyComponent={
            !isLoading ? (
              <ThemedText themeColor="textSecondary">
                {entries.length === 0
                  ? 'No entries from other users yet.'
                  : 'No places match your search/filter.'}
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.card}>
              <Link href={{ pathname: '/place/[id]', params: { id: item.place_id } }} asChild>
                <Pressable style={styles.cardInfo}>
                  <ThemedView type="backgroundSelected" style={styles.avatar}>
                    <ThemedText type="smallBold">
                      {item.user.display_name.charAt(0).toUpperCase()}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.cardText}>
                    <ThemedText type="smallBold">{item.place.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      saved by {item.user.display_name}
                    </ThemedText>
                    <ThemedText type="small">
                      {item.visited ? `★ ${item.rating ?? '–'}` : 'Want to try'}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </Link>
              <Pressable onPress={() => addToOwnList(item)} style={[styles.addButton, { borderColor: theme.text }]}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
            </ThemedView>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    marginTop: Spacing.two,
  },
  searchInput: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  chipList: {
    flexGrow: 0,
  },
  chipRow: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  chip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.six,
    paddingTop: Spacing.one,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: Spacing.half,
  },
  addButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
