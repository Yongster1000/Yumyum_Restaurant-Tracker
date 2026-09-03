import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { EntryForm } from '@/components/entry-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import type { Entry, Place } from '@/types/database';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<(Entry & { place: Place }) | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('entries')
      .select('*, place:places(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => setEntry(data as Entry & { place: Place }));
  }, [id]);

  if (!entry) {
    return (
      <ThemedView type="background" style={styles.loading}>
        <ThemedText variant="body" color="neutral700">
          Loading…
        </ThemedText>
      </ThemedView>
    );
  }

  return <EntryForm mode="edit" entry={entry} placeName={entry.place.name} placeAddress={entry.place.address} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
