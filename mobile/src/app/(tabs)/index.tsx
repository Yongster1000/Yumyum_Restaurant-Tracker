import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Card } from '@/components/card';
import { FloatingTabBar } from '@/components/floating-tab-bar';
import { PlusIcon, StarIcon, UtensilsIcon } from '@/components/icons';
import { SearchBar } from '@/components/search-bar';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Entry, FoodType, Place } from '@/types/database';

type OwnEntry = Entry & {
  place: Place & { place_food_types: { food_type: FoodType }[] };
};

const UNVISITED_FILTER = 'Unvisited';
const ALL_FILTER = 'All';

export default function OwnScreen() {
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

  const showEmptyState = !isLoading && entries.length === 0;
  const showLoadingSkeleton = isLoading && entries.length === 0;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText variant="bodySemibold" color="accent700" style={styles.kicker}>
            Yumyums
          </ThemedText>
          <ThemedText variant="heading" style={styles.title}>
            My places
          </ThemedText>
        </View>

        {!showEmptyState && (
          <>
            <View style={styles.searchRow}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search your saved places" />
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={foodTypeFilters}
              keyExtractor={(name) => name}
              contentContainerStyle={styles.chipRow}
              style={styles.chipList}
              renderItem={({ item: filterName }) => (
                <Chip label={filterName} selected={filterName === activeFilter} onPress={() => setActiveFilter(filterName)} />
              )}
            />
          </>
        )}

        {showLoadingSkeleton ? (
          <View style={styles.listContent}>
            {[0.7, 0.45].map((opacity, index) => (
              <Card key={index} style={[styles.entryCard, { opacity }]}>
                <View style={[styles.thumb, styles.skeletonThumb]} />
                <View style={styles.skeletonBody}>
                  <View style={[styles.skeletonBar, { width: index === 0 ? '62%' : '48%' }]} />
                  <View style={[styles.skeletonBarSmall, { width: index === 0 ? '38%' : '30%' }]} />
                </View>
              </Card>
            ))}
          </View>
        ) : showEmptyState ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBubble}>
              <UtensilsIcon size={54} color={Colors.accent2700} />
            </View>
            <ThemedText variant="heading" style={styles.emptyTitle}>
              Nothing saved yet
            </ThemedText>
            <ThemedText variant="body" color="neutral700" style={styles.emptyBody}>
              Add the place you keep meaning to try — the list grows from there.
            </ThemedText>
            <Link href="/entry/new" asChild>
              <Button variant="primary" style={styles.emptyButton}>
                <View style={styles.emptyButtonContent}>
                  <PlusIcon size={18} color={Colors.background} />
                  <ThemedText variant="heading" color="background" style={styles.emptyButtonLabel}>
                    Add a place
                  </ThemedText>
                </View>
              </Button>
            </Link>
          </View>
        ) : (
          <FlatList
            data={filteredEntries}
            keyExtractor={(entry) => entry.id}
            contentContainerStyle={styles.listContent}
            refreshing={isLoading}
            onRefresh={loadEntries}
            ListEmptyComponent={
              <ThemedText variant="body" color="neutral700">
                No places match your search/filter.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <Link href={{ pathname: '/place/[id]', params: { id: item.place_id } }} asChild>
                <Pressable>
                  <Card style={styles.entryCard}>
                    {item.photos[0] ? (
                      <Image source={{ uri: item.photos[0] }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <UtensilsIcon size={26} color={Colors.accent2700} />
                      </View>
                    )}
                    <View style={styles.entryBody}>
                      <ThemedText variant="heading" style={styles.entryName}>
                        {item.place.name}
                      </ThemedText>
                      {item.place.place_food_types.length > 0 && (
                        <View style={styles.tagRow}>
                          {item.place.place_food_types.map((row, index) => (
                            <Tag key={row.food_type.id} variant={index === 0 ? 'accent' : 'accent2'}>
                              {row.food_type.name}
                            </Tag>
                          ))}
                        </View>
                      )}
                    </View>
                    {item.visited ? (
                      <View style={styles.ratingBadge}>
                        <StarIcon size={20} active color={Colors.accent} />
                        <ThemedText variant="bodyBold" style={styles.ratingText}>
                          {(item.rating ?? 0).toFixed(1)}
                        </ThemedText>
                      </View>
                    ) : (
                      <Tag variant="outline">Want to try</Tag>
                    )}
                  </Card>
                </Pressable>
              </Link>
            )}
          />
        )}
      </SafeAreaView>

      <View style={styles.fab}>
        <Link href="/entry/new" asChild>
          <Pressable style={styles.fabPressable}>
            <PlusIcon size={28} color={Colors.background} />
          </Pressable>
        </Link>
      </View>

      <FloatingTabBar active="own" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.space6,
    paddingTop: Spacing.space4,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 38,
    marginTop: 6,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.space6,
    paddingTop: Spacing.space3,
  },
  chipList: {
    flexGrow: 0,
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: Spacing.space6,
    paddingVertical: Spacing.space3,
  },
  listContent: {
    gap: Spacing.space3,
    paddingHorizontal: Spacing.space6,
    paddingTop: 2,
    paddingBottom: BottomTabInset + Spacing.space6,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 24,
    flexShrink: 0,
  },
  thumbPlaceholder: {
    backgroundColor: Colors.accent2200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonThumb: {
    backgroundColor: Colors.neutral300,
  },
  entryBody: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  entryName: {
    fontSize: 19,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingBadge: {
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 15,
  },
  skeletonBody: {
    flex: 1,
    gap: 9,
  },
  skeletonBar: {
    height: 15,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutral300,
  },
  skeletonBarSmall: {
    height: 11,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutral200,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.space6,
    paddingTop: Spacing.space6,
    gap: Spacing.space3,
  },
  emptyIconBubble: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: Colors.accent2200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 25,
    marginTop: Spacing.space2,
  },
  emptyBody: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 270,
  },
  emptyButton: {
    marginTop: Spacing.space2,
    minHeight: 50,
    paddingHorizontal: 26,
  },
  emptyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyButtonLabel: {
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 126,
  },
  fabPressable: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
