import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { InteractionManager, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { EntryForm } from '@/components/entry-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Entry, EntryItem, Place } from '@/types/database';

type EntryWithDetails = Entry & { place: Place; entry_items: EntryItem[] };

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<EntryWithDetails | null>(null);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setHasError(false);
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*, place:places(*), entry_items(*)')
        .eq('id', id)
        .order('position', { foreignTable: 'entry_items' })
        .single();
      if (error) throw error;
      setEntry(data as EntryWithDetails);
    } catch (error) {
      console.error('Failed to load entry', error);
      setHasError(true);
    }
  }, [id]);

  // Deferred via InteractionManager — see the matching comment in
  // (tabs)/index.tsx: refetching immediately on focus can race a still-
  // animating modal-dismiss transition and crash Fabric's SvgView mounting.
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        load();
      });
      return () => task.cancel();
    }, [load]),
  );

  if (hasError) {
    return (
      <ThemedView type="background" style={styles.loading}>
        <ThemedText variant="body" color="neutral700" style={styles.errorText}>
          Couldn&apos;t load this entry. Check your connection and try again.
        </ThemedText>
        <Button variant="primary" onPress={load}>
          Try again
        </Button>
      </ThemedView>
    );
  }

  if (!entry) {
    return (
      <ThemedView type="background" style={styles.loading}>
        <ThemedText variant="body" color="neutral700">
          Loading…
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <EntryForm
      mode="edit"
      entry={entry}
      placeName={entry.place.name}
      placeAddress={entry.place.address}
      initialDishes={entry.entry_items}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.space3,
    paddingHorizontal: Spacing.space6,
  },
  errorText: {
    textAlign: 'center',
  },
});
