import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { prefetchReceiptImages } from '@/lib/images/receipt-image-cache';

type Props = {
  visible: boolean;
  urls: string[];
  /** Ảnh mở đầu (0-based) */
  initialIndex: number;
  onClose: () => void;
};

/**
 * Fullscreen gallery: vuốt ngang, chụm/phóng to (double-tap), kéo để đóng.
 * `react-native-image-viewing` + Expo (gesture-handler / reanimated đã có sẵn trong project).
 */
export function ReceiptImageLightbox({ visible, urls, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const images = useMemo(() => urls.map((uri) => ({ uri })), [urls]);

  const safeIndex = Math.min(Math.max(0, initialIndex), Math.max(0, urls.length - 1));

  const urlsKey = urls.join('\u0001');
  useEffect(() => {
    if (!visible || urls.length === 0) return;
    void prefetchReceiptImages(urls);
  }, [visible, urlsKey, urls]);

  if (urls.length === 0) {
    return null;
  }

  return (
    <ImageViewing
      images={images}
      imageIndex={safeIndex}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      animationType="fade"
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      backgroundColor="#000"
      HeaderComponent={({ imageIndex }) => (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {urls.length > 1 ? `${imageIndex + 1} / ${urls.length}` : 'Ảnh phiếu'}
          </Text>
          <Pressable onPress={onClose} hitSlop={16} accessibilityRole="button" accessibilityLabel="Đóng">
            <MaterialIcons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    marginRight: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
