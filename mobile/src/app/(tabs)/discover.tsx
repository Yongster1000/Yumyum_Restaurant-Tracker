import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { FloatingTabBar } from '@/components/floating-tab-bar';
import { PlusIcon, StarIcon } from '@/components/icons';
import { SearchBar } from '@/components/search-bar';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Entry, Place, User } from '@/types/database';

type DiscoverEntry = Entry & { place: Place; user: User };

const EVERYONE_FILTER = 'everyone';

// Rotates avatar background/text colors across three of the design's
// accent ramps so a list of different users doesn't read as monochrome.
const AVATAR_STYLES = [
  { background: Colors.accent2300, color: Colors.accent2800 },
  { background: Colors.accent300, color: Colors.accent800 },
  { background: Colors.neutral300, color: Colors.neutral800 },
] as const;

export default function DiscoverScreen() {
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

        <View style={styles.searchRow}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search by user or place" />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: EVERYONE_FILTER, displayName: 'Everyone' }, ...userFilters]}
          keyExtractor={(user) => user.id}
          contentContainerStyle={styles.chipRow}
          style={styles.chipList}
          renderItem={({ item: user }) => (
            <Chip label={user.displayName} selected={user.id === activeUserId} onPress={() => setActiveUserId(user.id)} />
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
              <ThemedText variant="body" color="neutral700">
                {entries.length === 0 ? 'No entries from other users yet.' : 'No places match your search/filter.'}
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
      </SafeAreaView>

      <FloatingTabBar active="discover" />
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    fontSize: 14,
  },
  wantToTryTag: {
    marginTop: 2,
  },
  addButton: {
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
});
