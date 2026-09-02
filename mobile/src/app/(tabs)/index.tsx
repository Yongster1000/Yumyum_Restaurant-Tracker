import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { EntryWithPlace } from '@/types/database';

export default function OwnScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [entries, setEntries] = useState<EntryWithPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('entries')
      .select('*, place:places(*)')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });
    if (!error && data) {
      setEntries(data as EntryWithPlace[]);
    }
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries]),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="title" style={styles.title}>
          My places
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
                No saved places yet. Tap + to add your first one.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/place/[id]', params: { id: item.place_id } }} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">{item.place.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.place.address}
                  </ThemedText>
                  <ThemedText type="small">
                    {item.visited ? `★ ${item.rating ?? '–'}` : 'Want to try'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
        />
      </SafeAreaView>

      <Link href="/entry/new" asChild>
        <Pressable style={[styles.fab, { backgroundColor: theme.text }]}>
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
    gap: Spacing.half,
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
