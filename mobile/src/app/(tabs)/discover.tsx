import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Entry, Place, User } from '@/types/database';

type DiscoverEntry = Entry & { place: Place; user: User };

export default function DiscoverScreen() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<DiscoverEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={loadEntries}
          ListEmptyComponent={
            !isLoading ? (
              <ThemedText themeColor="textSecondary">
                No entries from other users yet.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.card}>
              <Link href={{ pathname: '/place/[id]', params: { id: item.place_id } }} asChild>
                <Pressable style={styles.cardInfo}>
                  <ThemedText type="smallBold">{item.place.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    saved by {item.user.display_name}
                  </ThemedText>
                  <ThemedText type="small">
                    {item.visited ? `★ ${item.rating ?? '–'}` : 'Want to try'}
                  </ThemedText>
                </Pressable>
              </Link>
              <Pressable onPress={() => addToOwnList(item)} style={styles.addButton}>
                <ThemedText type="link">Add to my list</ThemedText>
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
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    marginTop: Spacing.two,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardInfo: {
    gap: Spacing.half,
  },
  addButton: {
    alignSelf: 'flex-start',
  },
});
