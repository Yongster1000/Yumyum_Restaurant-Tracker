import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Entry } from '@/types/database';

// TODO: replace with Google Places autocomplete + fuzzy-match against
// existing `places` rows (search-before-create flow described in the brief).
// For now this scaffold takes place name/address as plain text and always
// creates a new `places` row when adding.
//
// TODO: food type multi-select chips (search-before-create against
// `food_types`, writing to `place_food_types`) are not wired up yet.

type EntryFormProps = {
  mode: 'create' | 'edit';
  entry?: Entry;
  placeName?: string;
  onSaved?: () => void;
};

export function EntryForm({ mode, entry, placeName, onSaved }: EntryFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();

  const [name, setName] = useState(placeName ?? '');
  const [address, setAddress] = useState('');
  const [visited, setVisited] = useState(entry?.visited ?? false);
  const [rating, setRating] = useState(entry?.rating ?? 0);
  const [comment, setComment] = useState(entry?.comment ?? '');
  const [photoUris, setPhotoUris] = useState<string[]>(entry?.photos ?? []);
  const [isSaving, setIsSaving] = useState(false);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      setPhotoUris((current) => [...current, ...result.assets.map((asset) => asset.uri)]);
    }
  }

  async function uploadPhotos(userId: string, entryId: string) {
    const uploadedUrls: string[] = [];
    for (const uri of photoUris) {
      if (uri.startsWith('https://')) {
        // Already uploaded (editing an existing entry).
        uploadedUrls.push(uri);
        continue;
      }
      const fileName = uri.split('/').pop() ?? `${Date.now()}.jpg`;
      const path = `${userId}/${entryId}/${fileName}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('entry-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('entry-photos').getPublicUrl(path);
      uploadedUrls.push(data.publicUrl);
    }
    return uploadedUrls;
  }

  async function handleSave() {
    if (!session) return;
    setIsSaving(true);
    try {
      let placeId = entry?.place_id;

      if (mode === 'create') {
        // Placeholder dedup key until Google Places autocomplete supplies a
        // real google_place_id.
        const { data: place, error: placeError } = await supabase
          .from('places')
          .insert({
            google_place_id: `manual-${Date.now()}`,
            name,
            address,
            lat: 0,
            lng: 0,
          })
          .select()
          .single();
        if (placeError) throw placeError;
        placeId = place.id;
      }

      if (!placeId) throw new Error('Missing place for this entry.');

      const { data: savedEntry, error: entryError } = await supabase
        .from('entries')
        .upsert(
          {
            id: entry?.id,
            user_id: session.user.id,
            place_id: placeId,
            visited,
            rating: visited ? rating || null : null,
            comment: comment || null,
          },
          { onConflict: 'user_id,place_id' },
        )
        .select()
        .single();
      if (entryError) throw entryError;

      if (photoUris.length > 0) {
        const photoUrls = await uploadPhotos(session.user.id, savedEntry.id);
        const { error: photoError } = await supabase
          .from('entries')
          .update({ photos: photoUrls })
          .eq('id', savedEntry.id);
        if (photoError) throw photoError;
      }

      onSaved?.();
      router.back();
    } catch (error) {
      Alert.alert('Could not save entry', error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        Place
      </ThemedText>
      <TextInput
        placeholder="Restaurant name"
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
        editable={mode === 'create'}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      {mode === 'create' && (
        <TextInput
          placeholder="Address"
          placeholderTextColor={theme.textSecondary}
          value={address}
          onChangeText={setAddress}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
      )}

      <ThemedView style={styles.row}>
        <ThemedText>Visited</ThemedText>
        <Switch value={visited} onValueChange={setVisited} />
      </ThemedView>

      {visited && (
        <ThemedView style={styles.row}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable key={value} onPress={() => setRating(value)}>
              <ThemedText type="title" themeColor={value <= rating ? 'text' : 'textSecondary'}>
                ★
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Comment
      </ThemedText>
      <TextInput
        placeholder="What did you think?"
        placeholderTextColor={theme.textSecondary}
        value={comment}
        onChangeText={setComment}
        multiline
        style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      <Pressable onPress={pickPhoto} style={[styles.secondaryButton, { borderColor: theme.backgroundSelected }]}>
        <ThemedText type="link">Add photos ({photoUris.length})</ThemedText>
      </Pressable>

      <Pressable
        onPress={handleSave}
        disabled={isSaving || !name}
        style={[styles.button, { backgroundColor: theme.text, opacity: isSaving || !name ? 0.5 : 1 }]}>
        <ThemedText style={{ color: theme.background }} type="smallBold">
          {isSaving ? 'Saving…' : 'Save'}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
});
