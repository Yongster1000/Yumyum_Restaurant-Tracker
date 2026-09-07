import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CircleButton } from '@/components/button';
import { XIcon } from '@/components/icons';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

// Pinch-to-zoom + pan + double-tap-to-zoom on a single image. Panning is only
// meaningful once zoomed in; while at scale 1 the parent FlatList still owns
// horizontal swipes between photos (see `onZoomChange`).
function ZoomableImage({
  uri,
  width,
  height,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  // Mirrors `onZoomChange` locally so the pan gesture below can be disabled
  // while unzoomed — a GestureDetector claims single-finger drags even when
  // its handler internally no-ops, which was blocking the FlatList's own
  // paging scroll from ever seeing the touch.
  const [isZoomedLocal, setIsZoomedLocal] = useState(false);

  function reportZoomed(zoomed: boolean) {
    setIsZoomedLocal(zoomed);
    onZoomChange(zoomed);
  }

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(reportZoomed)(false);
      }
    });

  const pan = Gesture.Pan()
    .enabled(isZoomedLocal)
    .onUpdate((event) => {
      if (savedScale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomingIn = savedScale.value <= 1;
      const next = zoomingIn ? DOUBLE_TAP_SCALE : 1;
      scale.value = withTiming(next);
      savedScale.value = next;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      runOnJS(reportZoomed)(zoomingIn);
    });

  const composedGesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

export function PhotoViewer({
  photos,
  initialIndex,
  visible,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* RN's <Modal> renders into its own native surface, separate from the
          app's root view hierarchy — gesture-handler needs its own root
          inside that surface or pinch/pan silently don't respond. */}
      <GestureHandlerRootView style={styles.container}>
        {/* Mounted fresh each time the viewer opens, so `index`/`isZoomed`
            below always start from a clean slate for whichever photo was
            tapped — no effect needed to resync them from props. */}
        {visible && <PhotoViewerContent photos={photos} initialIndex={initialIndex} onClose={onClose} />}
      </GestureHandlerRootView>
    </Modal>
  );
}

function PhotoViewerContent({
  photos,
  initialIndex,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        scrollEnabled={!isZoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(uri) => uri}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <ZoomableImage uri={item} width={width} height={height} onZoomChange={setIsZoomed} />
        )}
      />

      <View style={styles.header}>
        {photos.length > 1 && (
          <Text style={styles.counter}>
            {index + 1} / {photos.length}
          </Text>
        )}
        <CircleButton onPress={onClose} size={40} backgroundColor="rgba(0,0,0,0.55)" style={styles.closeButton}>
          <XIcon size={18} color="#fff" />
        </CircleButton>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  counter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 'auto',
  },
  closeButton: {},
});
