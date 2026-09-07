import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { CircleButton } from '@/components/button';
import { ChevronLeftIcon, PencilIcon, StarIcon, UtensilsIcon } from '@/components/icons';
import { PhotoViewer } from '@/components/photo-viewer';
import { Tag } from '@/components/tag';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getPlacePhotoUrl } from '@/lib/google-places';
import { supabase } from '@/lib/supabase';
import type { Entry, FoodType, Place, User } from '@/types/database';

type EntryWithUser = Entry & { user: User };

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [entries, setEntries] = useState<EntryWithUser[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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

  // All food photos across every user's entry for this place, deduped, shown
  // as their own scrollable row (separate from the restaurant's own Google
  // photo used in the hero above).
  const photos = useMemo(() => Array.from(new Set(entries.flatMap((entry) => entry.photos))), [entries]);

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
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <StarIcon key={value} size={14} active={value <= (entry.rating ?? 0)} color={Colors.accent} />
                      ))}
                    </View>
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
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>

      <PhotoViewer
        photos={photos}
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
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 15,
    lineHeight: 22,
  },
});
