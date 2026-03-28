import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OwnerListChrome } from '@/components/owner/owner-list-chrome';
import { Brand } from '@/constants/brand';
import { listWeighingStations } from '@/lib/api/weighing-stations';
import type { WeighingStation } from '@/lib/types/ops';

const PAGE_SIZE = 15;

export default function WeighingStationsScreen() {
  const [items, setItems] = useState<WeighingStation[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (nextPage: number, append: boolean) => {
    const res = await listWeighingStations({ page: nextPage, limit: PAGE_SIZE });
    if (!res.ok) {
      if (res.forbidden) {
        setForbidden(true);
        setItems([]);
        setHasNext(false);
        return;
      }
      throw new Error(res.message);
    }
    setForbidden(false);
    if (append) {
      setItems((prev) => [...prev, ...res.body.data]);
    } else {
      setItems(res.body.data);
    }
    setHasNext(res.body.hasNextPage);
    setPage(nextPage);
  }, []);

  const initialLoad = useCallback(async () => {
    setError(null);
    setForbidden(false);
    setLoading(true);
    try {
      await loadPage(1, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách');
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadPage(1, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách');
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const onEndReached = useCallback(async () => {
    if (forbidden || !hasNext || loadingMore || loading) {
      return;
    }
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [forbidden, hasNext, loadPage, loadingMore, loading, page]);

  const renderItem = useCallback(({ item }: { item: WeighingStation }) => {
    const price =
      item.unitPrice != null
        ? `${item.unitPrice.toLocaleString('vi-VN')} VND/tấn`
        : '—';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {item.code ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.code}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardMeta}>{price}</Text>
        {item.formattedAddress ? (
          <Text style={styles.cardSub}>{item.formattedAddress}</Text>
        ) : null}
        {item.status ? (
          <Text style={styles.cardHint}>Trạng thái: {item.status}</Text>
        ) : null}
      </View>
    );
  }, []);

  if (forbidden && !loading) {
    return (
      <View style={styles.root}>
        <OwnerListChrome
          title="Trạm cân"
          subtitle="Theo API hiện tại, danh sách trạm cân có thể chỉ dành cho admin."
        />
        <View style={styles.blockedBox}>
          <Text style={styles.blockedTitle}>Không có quyền xem</Text>
          <Text style={styles.blockedBody}>
            Backend trả về 403 cho tài khoản Owner. Vui lòng dùng Admin Dashboard hoặc yêu cầu mở quyền đọc
            trạm cân cho owner.
          </Text>
          <Pressable onPress={() => void initialLoad()} style={styles.retry}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <OwnerListChrome
        title="Trạm cân"
        subtitle="Đơn giá theo tấn dùng khi duyệt phiếu (theo cấu hình trạm)."
      />
      {error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void initialLoad()} style={styles.retry}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Brand.forest} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            !loading && !error ? (
              <Text style={styles.empty}>Chưa có trạm cân hoặc danh sách trống.</Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.footerLoader} color={Brand.forest} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
  },
  badge: {
    backgroundColor: Brand.surfaceQuiet,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.forest,
  },
  cardMeta: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.forest,
  },
  cardSub: {
    marginTop: 8,
    fontSize: 14,
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  cardHint: {
    marginTop: 6,
    fontSize: 13,
    color: Brand.metallicDeep,
  },
  centerBox: {
    padding: 24,
    alignItems: 'center',
  },
  blockedBox: {
    padding: 24,
    margin: 16,
    backgroundColor: Brand.surface,
    borderRadius: 16,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 8,
  },
  blockedBody: {
    fontSize: 15,
    color: Brand.inkMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
  errorText: {
    color: '#B00020',
    textAlign: 'center',
    marginBottom: 12,
  },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Brand.forest,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: Brand.inkMuted,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  footerLoader: {
    marginVertical: 16,
  },
});
