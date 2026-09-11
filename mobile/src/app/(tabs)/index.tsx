import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, CircleButton } from '@/components/button';
import { Chip } from '@/components/chip';
import { Card } from '@/components/card';
import { PlusIcon, LogOutIcon, StarIcon, UtensilsIcon } from '@/components/icons';
import { SearchBar } from '@/components/search-bar';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getPlacePhotoUrl } from '@/lib/google-places';
import { supabase } from '@/lib/supabase';
import type { Entry, EntryItem, FoodType, Place } from '@/types/database';

type OwnEntry = Entry & {
  place: Place & { place_food_types: { food_type: FoodType }[] };
  entry_items: Pick<EntryItem, 'id'>[];
};

const UNVISITED_FILTER = 'Unvisited';
const ALL_FILTER = 'All';

export default function OwnScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<OwnEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(ALL_FILTER);

  const loadEntries = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*, place:places(*, place_food_types(food_type:food_types(*))), entry_items(id)')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setEntries((data ?? []) as OwnEntry[]);
    } catch (error) {
      console.error('Failed to load entries', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Deferred via InteractionManager: refetching (and re-rendering new Cards/
  // icons) immediately on focus can land while the modal-dismiss transition
  // that brought us back here (from entry/new or entry/[id]) is still
  // animating — on Android/Fabric this has crashed with "addViewAt: view
  // already has a parent" on an SvgView, since Fabric can't reparent a
  // native SVG view mid-transition. Waiting for interactions to finish
  // avoids racing that transition.
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadEntries();
      });
      return () => task.cancel();
    }, [loadEntries]),
  );

  function handleSignOut() {
    Alert.alert('Sign out?', 'You\'ll need to sign in again to see your places.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) {
            Alert.alert('Could not sign out', error.message);
          }
          // No manual navigation needed: (tabs)/_layout redirects to
          // /(auth)/sign-in once `session` becomes null.
        },
      },
    ]);
  }

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

  const showErrorState = !isLoading && hasError;
  const showEmptyState = !isLoading && !hasError && entries.length === 0;
  const showLoadingSkeleton = isLoading && !hasError && entries.length === 0;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText variant="bodySemibold" color="accent700" style={styles.kicker}>
              Yumyums
            </ThemedText>
            <ThemedText variant="heading" style={styles.title}>
              My places
            </ThemedText>
          </View>
          <CircleButton size={40} onPress={handleSignOut}>
            <LogOutIcon size={18} color={Colors.neutral700} />
          </CircleButton>
        </View>

        {!showEmptyState && !showErrorState && (
          <>
            <View style={styles.searchRow}>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search your saved places" />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={styles.chipList}>
              {foodTypeFilters.map((filterName) => (
                <Chip
                  key={filterName}
                  label={filterName}
                  selected={filterName === activeFilter}
                  onPress={() => setActiveFilter(filterName)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {showLoadingSkeleton ? (
          <View style={[styles.listContent, { paddingBottom: styles.listContent.paddingBottom + insets.bottom }]}>
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
        ) : showErrorState ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBubble}>
              <UtensilsIcon size={54} color={Colors.accent2700} />
            </View>
            <ThemedText variant="heading" style={styles.emptyTitle}>
              Couldn&apos;t load your places
            </ThemedText>
            <ThemedText variant="body" color="neutral700" style={styles.emptyBody}>
              Something went wrong fetching your list. Check your connection and try again.
            </ThemedText>
            <Button variant="primary" style={styles.emptyButton} onPress={loadEntries}>
              Try again
            </Button>
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
            style={styles.entriesList}
            data={filteredEntries}
            keyExtractor={(entry) => entry.id}
            // styles.listContent.paddingBottom clears the floating tab bar on a
            // zero-inset device; add the device's own bottom inset on top so
            // Android's 3-button/gesture nav doesn't cover the last entry.
            contentContainerStyle={[styles.listContent, { paddingBottom: styles.listContent.paddingBottom + insets.bottom }]}
            refreshing={isLoading}
            onRefresh={loadEntries}
            ListEmptyComponent={
              <ThemedText variant="body" color="neutral700">
                No places match your search/filter.
              </ThemedText>
            }
            renderItem={({ item }) => {
              const thumbUri =
                (item.place.google_photo_name ? getPlacePhotoUrl(item.place.google_photo_name) : null) ??
                item.photos[0] ??
                null;
              return (
              <Link href={{ pathname: '/place/[id]', params: { id: item.place_id } }} asChild>
                <Pressable>
                  <Card style={[styles.entryCard, !item.visited && styles.entryCardUnvisited]}>
                    {item.place.cost_bracket && (
                      <ThemedText variant="bodySemibold" color="neutral600" style={styles.priceBadge}>
                        {item.place.cost_bracket}
                      </ThemedText>
                    )}
                    {thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <UtensilsIcon size={26} color={Colors.accent2700} />
                      </View>
                    )}
                    <View style={styles.entryBody}>
                      <ThemedText variant="heading" style={styles.entryName}>
                        {item.place.name}
                      </ThemedText>
                      {(item.place.place_food_types.length > 0 || item.entry_items.length > 0) && (
                        <View style={styles.tagRow}>
                          {item.place.place_food_types.map((row, index) => (
                            <Tag key={row.food_type.id} variant={index === 0 ? 'accent' : 'accent2'}>
                              {row.food_type.name}
                            </Tag>
                          ))}
                          {item.entry_items.length > 0 && (
                            <View style={styles.dishIndicator}>
                              <UtensilsIcon size={12} color={Colors.neutral600} />
                              <ThemedText variant="bodyMedium" color="neutral600" style={styles.dishIndicatorLabel}>
                                {item.entry_items.length}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    {item.visited && (
                      <View style={styles.ratingBadge}>
                        <StarIcon size={20} active color={Colors.accent} />
                        <ThemedText variant="bodyBold" style={styles.ratingText}>
                          {(item.rating ?? 0).toFixed(1)}
                        </ThemedText>
                      </View>
                    )}
                  </Card>
                </Pressable>
              </Link>
              );
            }}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.space6,
    paddingTop: Spacing.space4,
  },
  headerText: {
    flexShrink: 1,
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
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.space6,
    paddingVertical: Spacing.space3,
  },
  entriesList: {
    flex: 1,
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
    fontSize: 16,
  },
  entryCardUnvisited: {
    backgroundColor: Colors.accent100,
    borderWidth: 1.5,
    borderColor: Colors.accent200,
  },
  priceBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    fontSize: 13,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  dishIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dishIndicatorLabel: {
    fontSize: 11,
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
