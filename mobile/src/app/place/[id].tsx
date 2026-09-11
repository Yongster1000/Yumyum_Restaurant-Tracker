import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, CircleButton } from '@/components/button';
import { ChevronLeftIcon, PencilIcon, StarIcon, UtensilsIcon } from '@/components/icons';
import { PhotoViewer } from '@/components/photo-viewer';
import { StarRating } from '@/components/star-rating';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getPlacePhotoUrl } from '@/lib/google-places';
import { supabase } from '@/lib/supabase';
import type { Entry, EntryItem, FoodType, Place, User } from '@/types/database';

type EntryWithUser = Entry & { user: User; entry_items: EntryItem[] };

// e.g. 5 -> "5", 3.5 -> "3.5" — matches the mockup's compact right-aligned
// per-dish rating (no trailing ".0" for whole numbers).
function formatRating(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [entries, setEntries] = useState<EntryWithUser[]>([]);
  const [hasError, setHasError] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  // Which photo set the viewer is paging through — the place's whole photo
  // pool when opened from the top "Photos" row, or a single dish's `photos`
  // when opened from a dish's own thumbnail row.
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setHasError(false);

    try {
      const [placeResult, foodTypeResult, entriesResult] = await Promise.all([
        supabase.from('places').select('*').eq('id', id).single(),
        supabase.from('place_food_types').select('food_type:food_types(*)').eq('place_id', id),
        supabase
          .from('entries')
          .select('*, user:users(*), entry_items(*)')
          .eq('place_id', id)
          .order('position', { foreignTable: 'entry_items' }),
      ]);

      if (placeResult.error) throw placeResult.error;
      if (foodTypeResult.error) throw foodTypeResult.error;
      if (entriesResult.error) throw entriesResult.error;

      setPlace(placeResult.data);
      setFoodTypes(foodTypeResult.data.map((row) => row.food_type as unknown as FoodType));
      setEntries(entriesResult.data as EntryWithUser[]);
    } catch (error) {
      console.error('Failed to load place', error);
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

  // All food photos across every user's entry for this place, deduped, shown
  // as their own scrollable row (separate from the restaurant's own Google
  // photo used in the hero above).
  const photos = useMemo(() => Array.from(new Set(entries.flatMap((entry) => entry.photos))), [entries]);

  if (hasError) {
    return (
      <ThemedView type="background" style={styles.loadingContainer}>
        <ThemedText variant="body" color="neutral700" style={styles.errorText}>
          Couldn&apos;t load this place. Check your connection and try again.
        </ThemedText>
        <Button variant="primary" onPress={load}>
          Try again
        </Button>
      </ThemedView>
    );
  }

  if (!place) {
    return (
      <ThemedView type="background" style={styles.loadingContainer}>
        <ThemedText variant="body" color="neutral700">
          Loading…
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="background" style={styles.container}>
      <ScrollView>
        <View style={styles.hero}>
          {place.google_photo_name ? (
            <Image source={{ uri: getPlacePhotoUrl(place.google_photo_name) }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <UtensilsIcon size={54} color={Colors.accent2700} />
            </View>
          )}

          <CircleButton onPress={() => router.back()} size={44} style={styles.backButton}>
            <ChevronLeftIcon size={20} color={Colors.text} />
          </CircleButton>
        </View>

        <View style={styles.content}>
          <ThemedText variant="heading" style={styles.name}>
            {place.name}
          </ThemedText>
          <ThemedText variant="body" color="neutral700" style={styles.address}>
            {place.cost_bracket ? `${place.address} · ${place.cost_bracket}` : place.address}
          </ThemedText>

          {foodTypes.length > 0 && (
            <View style={styles.tagRow}>
              {foodTypes.map((foodType, index) => (
                <Tag key={foodType.id} variant={index === 0 ? 'accent' : 'accent2'} style={styles.tag}>
                  {foodType.name}
                </Tag>
              ))}
            </View>
          )}

          {photos.length > 0 && (
            <View style={styles.photosSection}>
              <ThemedText variant="bodySemibold" color="neutral600" style={styles.photosKicker}>
                Photos
              </ThemedText>
              <FlatList
                data={photos}
                keyExtractor={(uri) => uri}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoRow}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => {
                      setViewerPhotos(photos);
                      setViewerIndex(index);
                      setViewerVisible(true);
                    }}>
                    <Image source={{ uri: item }} style={styles.photoThumb} />
                  </Pressable>
                )}
              />
            </View>
          )}

          <ThemedText variant="heading" style={styles.reviewsTitle}>
            Reviews
          </ThemedText>

          <View style={styles.reviewList}>
            {entries.map((entry) => (
              <Card key={entry.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <ThemedText variant="heading" color="accent2800" style={styles.reviewAvatarLabel}>
                      {entry.user.display_name.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                  <ThemedText variant="bodyBold" style={styles.reviewName}>
                    {entry.user.display_name}
                  </ThemedText>
                  {entry.visited && (
                    <StarRating value={entry.rating ?? 0} readOnly size={14} gap={2} color={Colors.accent} />
                  )}
                  {entry.user_id === session?.user.id && (
                    <CircleButton
                      size={30}
                      backgroundColor={Colors.accent100}
                      onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}>
                      <PencilIcon size={14} color={Colors.accent700} />
                    </CircleButton>
                  )}
                </View>
                {entry.comment ? (
                  <ThemedText variant="body" style={styles.reviewComment}>
                    {entry.comment}
                  </ThemedText>
                ) : !entry.visited ? (
                  <Tag variant="outline">Want to try</Tag>
                ) : null}

                {entry.entry_items.length > 0 && (
                  <>
                    <View style={styles.dishDivider} />
                    <View style={styles.dishSectionHeader}>
                      <UtensilsIcon size={13} color={Colors.neutral600} />
                      <ThemedText variant="bodySemibold" color="neutral600" style={styles.dishSectionLabel}>
                        {entry.entry_items.length} {entry.entry_items.length === 1 ? 'dish' : 'dishes'}
                      </ThemedText>
                    </View>
                    <View style={styles.dishItemList}>
                      {entry.entry_items.map((dish) => (
                        <View key={dish.id} style={styles.dishItemBlock}>
                          <View style={styles.dishItemRow}>
                            <View style={styles.dishItemText}>
                              <ThemedText variant="bodyBold" style={styles.dishItemName}>
                                {dish.name}
                              </ThemedText>
                              {dish.note && (
                                <ThemedText variant="body" color="neutral600" style={styles.dishItemNote}>
                                  {dish.note}
                                </ThemedText>
                              )}
                            </View>
                            {dish.rating != null && (
                              <View style={styles.dishItemRating}>
                                <StarIcon size={13} active color={Colors.accent700} />
                                <ThemedText variant="bodyBold" color="accent700" style={styles.dishItemRatingLabel}>
                                  {formatRating(dish.rating)}
                                </ThemedText>
                              </View>
                            )}
                          </View>
                          {dish.photos.length > 0 && (
                            <View style={styles.dishPhotoRow}>
                              {dish.photos.map((uri, photoIndex) => (
                                <Pressable
                                  key={uri}
                                  onPress={() => {
                                    setViewerPhotos(dish.photos);
                                    setViewerIndex(photoIndex);
                                    setViewerVisible(true);
                                  }}>
                                  <Image source={{ uri }} style={styles.dishPhotoThumb} />
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>

      <PhotoViewer
        photos={viewerPhotos}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.space3,
    paddingHorizontal: Spacing.space6,
  },
  errorText: {
    textAlign: 'center',
  },
  hero: {
    height: 280,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
    overflow: 'hidden',
    backgroundColor: Colors.neutral300,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    backgroundColor: Colors.accent2200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: Spacing.space4,
  },
  content: {
    padding: Spacing.space6,
    gap: Spacing.space3,
  },
  name: {
    fontSize: 34,
  },
  address: {
    fontSize: 15,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  photosSection: {
    marginTop: Spacing.space2,
    gap: 8,
  },
  photosKicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  photoRow: {
    gap: 10,
  },
  photoThumb: {
    width: 84,
    height: 84,
    borderRadius: 24,
  },
  reviewsTitle: {
    fontSize: 20,
    marginTop: Spacing.space4,
  },
  reviewList: {
    gap: Spacing.space3,
  },
  reviewCard: {
    gap: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent2300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarLabel: {
    fontSize: 15,
  },
  reviewName: {
    flex: 1,
    fontSize: 15,
  },
  reviewComment: {
    fontSize: 15,
    lineHeight: 22,
  },
  dishDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 2,
  },
  dishSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dishSectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dishItemList: {
    gap: 8,
  },
  dishItemBlock: {
    gap: 6,
  },
  dishItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.space2,
  },
  dishPhotoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dishPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  dishItemText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dishItemName: {
    fontSize: 14,
  },
  dishItemNote: {
    fontSize: 13,
  },
  dishItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  dishItemRatingLabel: {
    fontSize: 13,
  },
});
