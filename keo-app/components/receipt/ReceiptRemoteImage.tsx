import { Image, type ImageContentFit } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';

import { RECEIPT_IMAGE_CACHE_POLICY } from '@/lib/images/receipt-image-cache';

type Props = {
  uri: string;
  /**
   * Khóa cache ổn định (vd. `images[].id` từ API) — giúp expo-image tái dùng file khi presigned URL đổi.
   */
  cacheKey?: string;
  /** Khung bọc (vd. aspectRatio, borderRadius) */
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  indicatorColor?: string;
};

/**
 * Ảnh từ URL với overlay loading — dùng hero/thumbnail phiếu (presigned có thể tải chậm).
 */
export function ReceiptRemoteImage({
  uri,
  cacheKey,
  containerStyle,
  style,
  contentFit = 'cover',
  indicatorColor = '#006a35',
}: Props) {
  const [loading, setLoading] = useState(true);

  const source = useMemo(
    () => (cacheKey ? { uri, cacheKey } : { uri }),
    [uri, cacheKey],
  );

  useEffect(() => {
    setLoading(true);
  }, [uri, cacheKey]);

  return (
    <View style={containerStyle}>
      {loading ? (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={indicatorColor} />
        </View>
      ) : null}
      <Image
        source={source}
        style={style}
        contentFit={contentFit}
        cachePolicy={RECEIPT_IMAGE_CACHE_POLICY}
        recyclingKey={cacheKey ?? uri}
        transition={200}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});
