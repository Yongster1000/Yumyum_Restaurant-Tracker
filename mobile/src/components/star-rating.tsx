import { Pressable, StyleSheet, View } from 'react-native';

import { StarIcon } from '@/components/icons';
import { Colors } from '@/constants/theme';

const STAR_INDEXES = [1, 2, 3, 4, 5];

type StarRatingProps = {
  /** 0-5 in 0.5 steps. 0 (or null, coerced by the caller) renders all-empty. */
  value: number;
  /** Omit (or pass `readOnly`) to render a non-interactive row, e.g. reviews. */
  onChange?: (next: number) => void;
  readOnly?: boolean;
  size?: number;
  gap?: number;
  color?: string;
  inactiveColor?: string;
};

/**
 * Shared 5-star rating row supporting half-star values. Interactive mode
 * splits each star into two adjacent half-width tap zones — tapping the left
 * half of star N sets the rating to N-0.5, the right half sets it to N. Used
 * for both the entry's own "Your rating" row and per-dish ratings; also
 * rendered read-only for displaying existing ratings (e.g. Place Detail).
 */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 24,
  gap = 8,
  color = Colors.accent,
  inactiveColor,
}: StarRatingProps) {
  const interactive = !readOnly && !!onChange;

  return (
    <View style={[styles.row, { gap }]}>
      {STAR_INDEXES.map((starIndex) => {
        const fraction = Math.max(0, Math.min(1, value - (starIndex - 1)));
        const star = <StarIcon size={size} fraction={fraction} color={color} inactiveColor={inactiveColor} />;

        if (!interactive) {
          return (
            <View key={starIndex} style={{ width: size, height: size }}>
              {star}
            </View>
          );
        }

        return (
          <View key={starIndex} style={{ width: size, height: size }}>
            {star}
            <View style={styles.tapOverlay}>
              <Pressable style={styles.tapHalf} hitSlop={4} onPress={() => onChange!(starIndex - 0.5)} />
              <Pressable style={styles.tapHalf} hitSlop={4} onPress={() => onChange!(starIndex)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  tapHalf: {
    flex: 1,
  },
});
