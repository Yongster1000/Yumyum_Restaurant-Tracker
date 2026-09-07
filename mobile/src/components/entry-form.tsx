import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button, CircleButton } from '@/components/button';
import { Card } from '@/components/card';
import { CameraIcon, StarIcon, UtensilsIcon, XIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  autocompletePlaces,
  createSessionToken,
  fetchPlaceDetails,
  type PlaceDetails,
  type PlacePrediction,
} from '@/lib/google-places';
import { supabase } from '@/lib/supabase';
import type { Entry } from '@/types/database';

// TODO: this only dedupes against existing `places` by google_place_id (an
// exact match on the place the user picked from Google). The brief also
// describes surfacing fuzzy-matched *existing saved places* alongside the
// Google results while typing — not implemented yet.

// Supabase's errors (PostgrestError, StorageError, etc.) are plain objects,
// not real `Error` instances — `error instanceof Error` is false for them,
// so a naive `String(error)` fallback prints "[object Object]" instead of
// the actual message.
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

type EntryFormProps = {
  mode: 'create' | 'edit';
  entry?: Entry;
  placeName?: string;
  placeAddress?: string;
  onSaved?: () => void;
};

export function EntryForm({ mode, entry, placeName, placeAddress, onSaved }: EntryFormProps) {
  const router = useRouter();
  const { session } = useAuth();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sessionToken, setSessionToken] = useState(createSessionToken);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [visited, setVisited] = useState(entry?.visited ?? false);
  const [rating, setRating] = useState(entry?.rating ?? 0);
  const [comment, setComment] = useState(entry?.comment ?? '');
  const [photoUris, setPhotoUris] = useState<string[]>(entry?.photos ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (mode !== 'create' || selectedPlace) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await autocompletePlaces(query, sessionToken);
        if (!cancelled) setSuggestions(results);
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Place search failed', getErrorMessage(error));
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sessionToken, mode, selectedPlace]);

  async function handleSelectSuggestion(prediction: PlacePrediction) {
    setIsSearching(true);
    try {
      const details = await fetchPlaceDetails(prediction.placeId, sessionToken);
      setSelectedPlace(details);
      setSuggestions([]);
    } catch (error) {
      Alert.alert('Could not load place details', getErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }

  function handleChangePlace() {
    setSelectedPlace(null);
    setQuery('');
    setSuggestions([]);
    setSessionToken(createSessionToken());
  }

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
      // supabase-js's docs call out that Blob/File/FormData bodies "do not
      // work as intended" on React Native — upload an ArrayBuffer instead.
      const buffer = await new File(uri).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('entry-photos')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('entry-photos').getPublicUrl(path);
      uploadedUrls.push(data.publicUrl);
    }
    return uploadedUrls;
  }

  // Food types are sourced solely from Google (no user-entered/edited tags)
  // — one tag per place, taken from its Google category. Select-then-insert
  // (mirroring the places dedup above) rather than upsert: `food_types` only
  // has an insert RLS policy, no update policy, and upsert's ON CONFLICT
  // path performs an UPDATE — which RLS then silently rejects on every use
  // of a category after its first.
  async function tagPlaceWithFoodType(placeId: string, foodTypeName: string) {
    const { data: existingFoodType, error: foodTypeLookupError } = await supabase
      .from('food_types')
      .select('id')
      .eq('name', foodTypeName)
      .maybeSingle();
    if (foodTypeLookupError) throw foodTypeLookupError;

    let foodTypeId = existingFoodType?.id as string | undefined;
    if (!foodTypeId) {
      const { data: newFoodType, error: insertError } = await supabase
        .from('food_types')
        .insert({ name: foodTypeName })
        .select('id')
        .single();
      if (insertError) throw insertError;
      foodTypeId = newFoodType.id as string;
    }

    const { error: tagError } = await supabase
      .from('place_food_types')
      .insert({ place_id: placeId, food_type_id: foodTypeId });
    if (tagError) throw tagError;
  }

  async function handleSave() {
    if (!session) return;
    setIsSaving(true);
    try {
      let placeId = entry?.place_id;

      if (mode === 'create') {
        if (!selectedPlace) throw new Error('Pick a place first.');

        // Search-before-create: reuse the existing row if another user has
        // already saved this exact Google place, instead of duplicating it.
        const { data: existingPlace, error: lookupError } = await supabase
          .from('places')
          .select('id, google_photo_name, cost_bracket')
          .eq('google_place_id', selectedPlace.placeId)
          .maybeSingle();
        if (lookupError) throw lookupError;

        if (existingPlace) {
          placeId = existingPlace.id as string;

          // Backfill any Google-sourced fields the existing row is still
          // missing (it may predate this data being fetched at all, or
          // Google may have had nothing to return the first time) — never
          // overwrites a value that's already set.
          const placeUpdate: { google_photo_name?: string; cost_bracket?: string } = {};
          if (!existingPlace.google_photo_name && selectedPlace.photoName) {
            placeUpdate.google_photo_name = selectedPlace.photoName;
          }
          if (!existingPlace.cost_bracket && selectedPlace.costBracket) {
            placeUpdate.cost_bracket = selectedPlace.costBracket;
          }
          if (Object.keys(placeUpdate).length > 0) {
            const { error: updateError } = await supabase.from('places').update(placeUpdate).eq('id', placeId);
            if (updateError) throw updateError;
          }

          const { data: existingTag, error: tagLookupError } = await supabase
            .from('place_food_types')
            .select('place_id')
            .eq('place_id', placeId)
            .maybeSingle();
          if (tagLookupError) throw tagLookupError;
          if (!existingTag && selectedPlace.foodType) {
            await tagPlaceWithFoodType(placeId, selectedPlace.foodType);
          }
        } else {
          const { data: place, error: placeError } = await supabase
            .from('places')
            .insert({
              google_place_id: selectedPlace.placeId,
              name: selectedPlace.name,
              address: selectedPlace.address,
              lat: selectedPlace.lat,
              lng: selectedPlace.lng,
              google_photo_name: selectedPlace.photoName,
              cost_bracket: selectedPlace.costBracket,
            })
            .select()
            .single();
          if (placeError) throw placeError;
          placeId = place.id as string;

          if (selectedPlace.foodType) {
            await tagPlaceWithFoodType(placeId, selectedPlace.foodType);
          }
        }
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
      Alert.alert('Could not save entry', getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!session || !entry) return;
    Alert.alert('Delete this entry?', 'This removes your visit, rating, comment, and photos for this place. This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            const { data: files } = await supabase.storage
              .from('entry-photos')
              .list(`${session.user.id}/${entry.id}`);
            if (files && files.length > 0) {
              await supabase.storage
                .from('entry-photos')
                .remove(files.map((file) => `${session.user.id}/${entry.id}/${file.name}`));
            }

            const { error } = await supabase.from('entries').delete().eq('id', entry.id);
            if (error) throw error;

            onSaved?.();
            // `back()` would only pop this modal, landing on the now-stale
            // Place Detail screen underneath. Go all the way to My places —
            // there's nothing left here worth seeing once your own entry is gone.
            router.dismissTo('/(tabs)');
          } catch (error) {
            Alert.alert('Could not delete entry', getErrorMessage(error));
            setIsDeleting(false);
          }
        },
      },
    ]);
  }

  const canSave = !isSaving && !isDeleting && (mode === 'edit' || !!selectedPlace);

  return (
    <ThemedView type="background" style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 90, default: 0 })}>
        <View style={styles.header}>
          <ThemedText variant="heading" style={styles.headerTitle}>
            {mode === 'create' ? 'Add a place' : 'Edit entry'}
          </ThemedText>
          <CircleButton size={36} onPress={() => router.back()} disabled={isSaving || isDeleting}>
            <XIcon size={18} color={Colors.neutral700} />
          </CircleButton>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <ThemedText variant="bodySemibold" color="neutral600" style={styles.kicker}>
              Place
            </ThemedText>

            {mode === 'edit' && (
              <Card style={styles.placeCard}>
                <View style={styles.placeThumb}>
                  <UtensilsIcon size={22} color={Colors.accent2700} />
                </View>
                <View style={styles.placeInfo}>
                  <ThemedText variant="heading" style={styles.placeName}>
                    {placeName}
                  </ThemedText>
                  {placeAddress && (
                    <ThemedText variant="body" color="neutral600" numberOfLines={1} style={styles.placeAddress}>
                      {placeAddress}
                    </ThemedText>
                  )}
                </View>
              </Card>
            )}

            {mode === 'create' && selectedPlace && (
              <Card style={styles.placeCard}>
                <View style={styles.placeThumb}>
                  <UtensilsIcon size={22} color={Colors.accent2700} />
                </View>
                <View style={styles.placeInfo}>
                  <ThemedText variant="heading" style={styles.placeName}>
                    {selectedPlace.name}
                  </ThemedText>
                  <ThemedText variant="body" color="neutral600" numberOfLines={1} style={styles.placeAddress}>
                    {selectedPlace.address}
                  </ThemedText>
                </View>
                <Button variant="ghost" onPress={handleChangePlace}>
                  Change
                </Button>
              </Card>
            )}

            {mode === 'create' && !selectedPlace && (
              <View>
                <TextInput
                  placeholder="Search for a restaurant"
                  placeholderTextColor={Colors.neutral500}
                  value={query}
                  onChangeText={setQuery}
                  style={styles.input}
                />
                {isSearching && <ActivityIndicator color={Colors.accent} style={styles.searchSpinner} />}
                {suggestions.length > 0 && (
                  <Card style={styles.suggestionList}>
                    {suggestions.map((suggestion) => (
                      <Pressable
                        key={suggestion.placeId}
                        onPress={() => handleSelectSuggestion(suggestion)}
                        style={styles.suggestionRow}>
                        <ThemedText variant="body">{suggestion.text}</ThemedText>
                      </Pressable>
                    ))}
                  </Card>
                )}
              </View>
            )}
          </View>

          <Card style={styles.visitedCard}>
            <View style={styles.row}>
              <ThemedText variant="bodySemibold" style={styles.rowLabel}>
                Visited
              </ThemedText>
              <Toggle value={visited} onValueChange={setVisited} />
            </View>

            {visited && (
              <View style={styles.section}>
                <ThemedText variant="bodySemibold" color="neutral600" style={styles.kicker}>
                  Your rating
                </ThemedText>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable key={value} onPress={() => setRating(value)}>
                      <StarIcon size={36} active={value <= rating} color={Colors.accent} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </Card>

          <View style={styles.section}>
            <ThemedText variant="bodySemibold" color="neutral600" style={styles.kicker}>
              Comment
            </ThemedText>
            <TextInput
              placeholder="What did you think?"
              placeholderTextColor={Colors.neutral500}
              value={comment}
              onChangeText={setComment}
              multiline
              style={[styles.input, styles.textArea]}
            />
          </View>

          <View style={styles.section}>
            <ThemedText variant="bodySemibold" color="neutral600" style={styles.kicker}>
              Photos
            </ThemedText>
            <View style={styles.photoGrid}>
              {photoUris.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumbWrapper}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <Pressable
                    onPress={() => setPhotoUris((current) => current.filter((_, i) => i !== index))}
                    style={styles.removePhotoButton}
                    hitSlop={8}>
                    <XIcon size={11} color="#fff" strokeWidth={3.2} />
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={pickPhoto} style={styles.addPhotoTile}>
                <CameraIcon size={22} color={Colors.neutral700} />
                <ThemedText variant="body" color="neutral700" style={styles.addPhotoLabel}>
                  Add
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <Button block onPress={handleSave} disabled={!canSave} style={styles.saveButton} textStyle={styles.saveButtonLabel}>
            {isSaving ? 'Saving…' : mode === 'create' ? 'Save this place' : 'Save changes'}
          </Button>

          {mode === 'edit' && (
            <Pressable onPress={handleDelete} disabled={isSaving || isDeleting} style={styles.deleteButton} hitSlop={8}>
              <ThemedText variant="bodySemibold" style={styles.deleteButtonLabel}>
                {isDeleting ? 'Deleting…' : 'Delete entry'}
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {isSaving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={Colors.background} />
          <ThemedText variant="bodySemibold" color="background" style={styles.savingLabel}>
            {photoUris.some((uri) => !uri.startsWith('https://')) ? 'Uploading photos…' : 'Saving…'}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

// Matches the design's pill switch (accent track, off-white thumb) more
// closely than react-native's platform-styled `Switch` can.
function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (next: boolean) => void }) {
  return (
    <Pressable onPress={() => onValueChange(!value)} style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
      <View style={styles.toggleThumb} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.space6,
    paddingTop: Spacing.space6,
    paddingBottom: Spacing.space2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
  },
  container: {
    paddingHorizontal: Spacing.space6,
    paddingBottom: Spacing.space8,
    gap: Spacing.space4,
  },
  section: {
    gap: 8,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
    borderRadius: Radius.lg,
  },
  placeThumb: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.accent2200,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  placeInfo: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    fontSize: 17,
  },
  placeAddress: {
    fontSize: 13,
  },
  input: {
    minHeight: 52,
    fontSize: 16,
    fontFamily: 'Figtree_400Regular',
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.space3,
  },
  textArea: {
    minHeight: 104,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  searchSpinner: {
    marginTop: Spacing.space2,
  },
  suggestionList: {
    marginTop: Spacing.space1,
    padding: 0,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: Spacing.space3,
    paddingVertical: Spacing.space3,
  },
  visitedCard: {
    gap: Spacing.space4,
    borderRadius: Radius.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.space3,
  },
  rowLabel: {
    flex: 1,
    fontSize: 17,
  },
  starRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumbWrapper: {
    position: 'relative',
  },
  photoThumb: {
    width: 84,
    height: 84,
    borderRadius: 24,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.neutral900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoTile: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.neutral400,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoLabel: {
    fontSize: 11,
  },
  saveButton: {
    minHeight: 56,
    marginTop: Spacing.space2,
  },
  saveButtonLabel: {
    fontSize: 18,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.space3,
  },
  deleteButtonLabel: {
    fontSize: 15,
    color: '#b3392a',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(32, 30, 29, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.space3,
  },
  savingLabel: {
    fontSize: 16,
  },
  toggleTrack: {
    width: 56,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutral300,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 3,
  },
  toggleTrackOn: {
    backgroundColor: Colors.accent,
    justifyContent: 'flex-end',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.background,
  },
});
