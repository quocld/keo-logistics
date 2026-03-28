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
import { aggregateDriversFromTrips, fetchTripsForDriverAggregation } from '@/lib/api/trips';
import type { AggregatedDriver } from '@/lib/types/ops';

const TRIP_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Mọi chuyến' },
  { value: 'in_progress', label: 'Đang chạy' },
  { value: 'planned', label: 'Đã lên kế hoạch' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
];

function tripStatusVi(s: string): string {
  const f = TRIP_STATUS_FILTERS.find((x) => x.value === s);
  return f?.label ?? s;
}

export default function DriversScreen() {
  const [tripStatus, setTripStatus] = useState('');
  const [drivers, setDrivers] = useState<AggregatedDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const trips = await fetchTripsForDriverAggregation({
      limitPerPage: 50,
      maxPages: 8,
      status: tripStatus || undefined,
    });
    setDrivers(aggregateDriversFromTrips(trips));
  }, [tripStatus]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được chuyến hàng');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được chuyến hàng');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const renderItem = useCallback(({ item }: { item: AggregatedDriver }) => {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.displayName}</Text>
        {item.email ? <Text style={styles.cardEmail}>{item.email}</Text> : null}
        <Text style={styles.cardMeta}>
          {item.tripCount} chuyến · Trạng thái gần nhất: {tripStatusVi(item.lastStatus)}
        </Text>
      </View>
    );
  }, []);

  return (
    <View style={styles.root}>
      <OwnerListChrome
        title="Tài xế"
        subtitle="Quản lý tài xế dựa trên hoạt động chuyến đi (GET /trips, owner scope)."
      />
      <View style={styles.chipsRow}>
        <FlatList
          horizontal
          data={TRIP_STATUS_FILTERS}
          keyExtractor={(x) => x.value || 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          renderItem={({ item: f }) => {
            const selected = tripStatus === f.value;
            return (
              <Pressable
                onPress={() => setTripStatus(f.value)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>
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
          data={drivers}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            !loading && !error ? (
              <Text style={styles.empty}>
                Chưa thấy tài xế nào từ chuyến hàng. Có thể chưa có trip hoặc trip không gắn driver.
              </Text>
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
  chipsRow: {
    backgroundColor: Brand.canvas,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.metallic,
  },
  chipsContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.chipMuted,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: Brand.forest,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkMuted,
  },
  chipTextSelected: {
    color: '#FFFFFF',
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
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
  },
  cardEmail: {
    marginTop: 4,
    fontSize: 14,
    color: Brand.forest,
  },
  cardMeta: {
    marginTop: 10,
    fontSize: 14,
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  centerBox: {
    padding: 24,
    alignItems: 'center',
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
});
