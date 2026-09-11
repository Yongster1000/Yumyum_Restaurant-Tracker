import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, InteractionManager, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { PlusIcon, StarIcon, UtensilsIcon } from '@/components/icons';
import { SearchBar } from '@/components/search-bar';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Entry, EntryItem, Place, User } from '@/types/database';

type DiscoverEntry = Entry & { place: Place; user: User; entry_items: Pick<EntryItem, 'id'>[] };

// Rotates avatar background/text colors across three of the design's
// accent ramps so a list of different users doesn't read as monochrome.
const AVATAR_STYLES = [
  { background: Colors.accent2300, color: Colors.accent2800 },
  { background: Colors.accent300, color: Colors.accent800 },
  { background: Colors.neutral300, color: Colors.neutral800 },
] as const;

export default function DiscoverScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiscoverEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [query, setQuery] = useState('');

  const loadEntries = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*, place:places(*), user:users(*), entry_items(id)')
        .neq('user_id', session.user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setEntries((data ?? []) as DiscoverEntry[]);
    } catch (error) {
      console.error('Failed to load discover entries', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Deferred via InteractionManager — see the matching comment in
  // (tabs)/index.tsx: refetching immediately on focus can race a still-
  // animating modal-dismiss transition and crash Fabric's SvgView mounting.
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadEntries();
      });
      return () => task.cancel();
    }, [loadEntries]),
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return entries;
    return entries.filter(
      (entry) =>
        entry.place.name.toLowerCase().includes(normalizedQuery) ||
        entry.user.display_name.toLowerCase().includes(normalizedQuery),
    );
  }, [entries, query]);

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
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText variant="bodySemibold" color="accent700" style={styles.kicker}>
            From your people
          </ThemedText>
          <ThemedText variant="heading" style={styles.title}>
            Discover
          </ThemedText>
        </View>

        {!(hasError && !isLoading) && (
          <View style={styles.searchRow}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search by user or place" />
          </View>
        )}

        {hasError && !isLoading ? (
          <View style={styles.errorState}>
            <ThemedText variant="heading" style={styles.errorTitle}>
              Couldn&apos;t load Discover
            </ThemedText>
            <ThemedText variant="body" color="neutral700" style={styles.errorBody}>
              Something went wrong fetching this list. Check your connection and try again.
            </ThemedText>
            <Button variant="primary" style={styles.errorButton} onPress={loadEntries}>
              Try again
            </Button>
          </View>
        ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(entry) => entry.id}
          // See the matching comment in (tabs)/index.tsx: add the device's own
          // bottom inset on top of the tab-bar clearance so Android's
          // 3-button/gesture nav doesn't cover the last entry.
          contentContainerStyle={[styles.listContent, { paddingBottom: styles.listContent.paddingBottom + insets.bottom }]}
          refreshing={isLoading}
          onRefresh={loadEntries}
          ListEmptyComponent={
            !isLoading ? (
              <ThemedText variant="body" color="neutral700">
                {entries.length === 0 ? 'No entries from other users yet.' : 'No places match your search.'}
              </ThemedText>
            ) : null
          }
          renderItem={({ item, index }) => {
            const avatarStyle = AVATAR_STYLES[index % AVATAR_STYLES.length];
            return (
              <Card style={styles.entryCard}>
                <Link href={{ pathname: '/place/[id]', params: { id: item.place_id } }} asChild>
                  <Pressable style={styles.entryInfo}>
                    <View style={[styles.avatar, { backgroundColor: avatarStyle.background }]}>
                      <ThemedText variant="heading" style={[styles.avatarLabel, { color: avatarStyle.color }]}>
                        {item.user.display_name.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.entryText}>
                      <ThemedText variant="heading" style={styles.entryName}>
                        {item.place.name}
                      </ThemedText>
                      <ThemedText variant="body" color="neutral600" style={styles.savedBy}>
                        saved by {item.user.display_name}
                      </ThemedText>
                      <View style={styles.metaRow}>
                        {item.visited ? (
                          <View style={styles.ratingRow}>
                            <StarIcon size={15} active color={Colors.accent} />
                            <ThemedText variant="bodyBold" color="accent700" style={styles.ratingText}>
                              {(item.rating ?? 0).toFixed(1)}
                            </ThemedText>
                          </View>
                        ) : (
                          <Tag variant="outline" style={styles.wantToTryTag}>
                            Want to try
                          </Tag>
                        )}
                        {item.entry_items.length > 0 && (
                          <View style={styles.dishIndicator}>
                            <UtensilsIcon size={12} color={Colors.neutral600} />
                            <ThemedText variant="bodyMedium" color="neutral600" style={styles.dishIndicatorLabel}>
                              {item.entry_items.length}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                </Link>
                <Button variant="icon" onPress={() => addToOwnList(item)} style={styles.addButton}>
                  <PlusIcon size={18} color={Colors.accent} />
                </Button>
              </Card>
            );
          }}
        />
        )}
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
    paddingBottom: Spacing.space3,
  },
  listContent: {
    gap: Spacing.space3,
    paddingHorizontal: Spacing.space6,
    paddingTop: 2,
    paddingBottom: BottomTabInset + Spacing.space6,
  },
  errorState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.space6,
    paddingTop: Spacing.space6,
    gap: Spacing.space3,
  },
  errorTitle: {
    fontSize: 22,
  },
  errorBody: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
  },
  errorButton: {
    marginTop: Spacing.space2,
    minHeight: 50,
    paddingHorizontal: 26,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
  },
  entryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 20,
  },
  entryText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  entryName: {
    fontSize: 19,
  },
  savedBy: {
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    fontSize: 14,
  },
  wantToTryTag: {
    marginTop: 0,
  },
  dishIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dishIndicatorLabel: {
    fontSize: 11,
  },
  addButton: {
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
});
