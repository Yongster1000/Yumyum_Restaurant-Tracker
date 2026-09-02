import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Entry, FoodType, Place, User } from '@/types/database';

type EntryWithUser = Entry & { user: User };

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [place, setPlace] = useState<Place | null>(null);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [entries, setEntries] = useState<EntryWithUser[]>([]);

  const load = useCallback(async () => {
    if (!id) return;

    const [placeResult, foodTypeResult, entriesResult] = await Promise.all([
      supabase.from('places').select('*').eq('id', id).single(),
      supabase.from('place_food_types').select('food_type:food_types(*)').eq('place_id', id),
      supabase.from('entries').select('*, user:users(*)').eq('place_id', id),
    ]);

    if (placeResult.data) setPlace(placeResult.data);
    if (foodTypeResult.data) {
      setFoodTypes(foodTypeResult.data.map((row) => row.food_type as unknown as FoodType));
    }
    if (entriesResult.data) setEntries(entriesResult.data as EntryWithUser[]);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!place) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          {place.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{place.address}</ThemedText>

        <ThemedView style={styles.chipRow}>
          {foodTypes.map((foodType) => (
            <ThemedView key={foodType.id} type="backgroundElement" style={styles.chip}>
              <ThemedText type="small">{foodType.name}</ThemedText>
            </ThemedView>
          ))}
        </ThemedView>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Reviews
        </ThemedText>

        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{item.user.display_name}</ThemedText>
              <ThemedText type="small">
                {item.visited ? `★ ${item.rating ?? '–'}` : 'Want to try'}
              </ThemedText>
              {item.comment && <ThemedText type="small">{item.comment}</ThemedText>}
            </ThemedView>
          )}
        />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: Spacing.two,
  },
  listContent: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
