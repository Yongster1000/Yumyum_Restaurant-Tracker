import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Entry, FoodType, Place } from '@/types/database';

type OwnEntry = Entry & {
  place: Place & { place_food_types: { food_type: FoodType }[] };
};

const UNVISITED_FILTER = 'Unvisited';
const ALL_FILTER = 'All';

export default function OwnScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [entries, setEntries] = useState<OwnEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(ALL_FILTER);

  const loadEntries = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('entries')
      .select('*, place:places(*, place_food_types(food_type:food_types(*)))')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });
    if (!error && data) {
      setEntries(data as OwnEntry[]);
    }
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries]),
  );

  const foodTypeFilters = useMemo(() => {
    const names = new Set<string>();
    for (const entry of entries) {
      for (const row of entry.place.place_food_types) {
        names.add(row.food_type.name);
      }
    }
    return [ALL_FILTER, ...Array.from(names).sort(), UNVISITED_FILTER];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesQuery = !normalizedQuery || entry.place.name.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        activeFilter === ALL_FILTER ||
        (activeFilter === UNVISITED_FILTER
          ? !entry.visited
          : entry.place.place_food_types.some((row) => row.food_type.name === activeFilter));
      return matchesQuery && matchesFilter;
    });
  }, [entries, query, activeFilter]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="title" style={styles.title}>
          My places
        </ThemedText>

        <TextInput
          placeholder="Search your saved places"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={foodTypeFilters}
          keyExtractor={(name) => name}
          contentContainerStyle={styles.chipRow}
          style={styles.chipList}
          renderItem={({ item: filterName }) => (
            <Pressable onPress={() => setActiveFilter(filterName)}>
              <ThemedView
                type={filterName === activeFilter ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.chip}>
                <ThemedText type="small">{filterName}</ThemedText>
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
                  ? 'No saved places yet. Tap + to add your first one.'
                  : 'No places match your search/filter.'}
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/place/[id]', params: { id: item.place_id } }} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.card}>
                  {item.photos[0] ? (
                    <Image source={{ uri: item.photos[0] }} style={styles.thumb} />
                  ) : (
                    <ThemedView type="backgroundSelected" style={styles.thumb} />
                  )}
                  <ThemedView style={styles.cardBody}>
                    <ThemedText type="smallBold">{item.place.name}</ThemedText>
                    {item.place.place_food_types.length > 0 && (
                      <ThemedView style={styles.tagRow}>
                        {item.place.place_food_types.map((row) => (
                          <ThemedView key={row.food_type.id} type="backgroundSelected" style={styles.tag}>
                            <ThemedText type="small">{row.food_type.name}</ThemedText>
                          </ThemedView>
                        ))}
                      </ThemedView>
                    )}
                    <ThemedText type="small">
                      {item.visited ? `★ ${item.rating ?? '–'}` : 'Want to try'}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />
      </SafeAreaView>

      <Link href="/entry/new" asChild>
        <Pressable style={StyleSheet.flatten([styles.fab, { backgroundColor: theme.text }])}>
          <ThemedText type="title" style={{ color: theme.background, lineHeight: 32 }}>
            +
          </ThemedText>
        </Pressable>
      </Link>
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
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'center',
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: Spacing.two,
  },
  cardBody: {
    flex: 1,
    gap: Spacing.half,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.three,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
