import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { aggregateDriversFromTrips, fetchTripsForDriverAggregation } from '@/lib/api/trips';
import type { AggregatedDriver } from '@/lib/types/ops';

const S = Brand.stitch;

const screenStyles = StyleSheet.create({
  ownerHint: {
    fontSize: 13,
    lineHeight: 19,
    color: `${S.outline}b3`,
    marginTop: 8,
    marginBottom: 4,
  },
  listContentFab: {
    paddingBottom: 140,
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: S.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const cardStyles = StyleSheet.create({
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}40`,
  },
  detailBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.outline,
  },
});

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

function formatDriverCode(id: string | number): string {
  const n = String(id).replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `#TX-${n}`;
}

type TripUi = {
  accent: string;
  pillBg: string;
  pillText: string;
};

function tripStatusUi(status: string): TripUi {
  switch (status) {
    case 'in_progress':
      return {
        accent: S.primary,
        pillBg: S.secondaryContainer,
        pillText: S.onSecondaryContainer,
      };
    case 'completed':
      return {
        accent: S.outlineVariant,
        pillBg: S.surfaceContainerHigh,
        pillText: S.onSurfaceVariant,
      };
    case 'cancelled':
      return {
        accent: S.tertiary,
        pillBg: S.tertiaryFixed,
        pillText: S.onTertiaryFixed,
      };
    case 'planned':
      return {
        accent: `${S.outlineVariant}99`,
        pillBg: S.surfaceContainerHigh,
        pillText: S.outline,
      };
    default:
      return {
        accent: S.primaryContainer,
        pillBg: S.surfaceContainerHigh,
        pillText: S.onSurfaceVariant,
      };
  }
}

function DriverCard({ item }: { item: AggregatedDriver }) {
  const ui = tripStatusUi(item.lastStatus);
  const pillLabel = tripStatusVi(item.lastStatus).toUpperCase();

  return (
    <View style={os.stitchCard}>
      <View style={[os.stitchAccent, { backgroundColor: ui.accent }]} pointerEvents="none" />
      <View style={os.stitchCardInner}>
        <View style={os.stitchCardHeader}>
          <View style={os.stitchTitleBlock}>
            <View style={os.stitchPillRow}>
              <View style={[os.statusPill, { backgroundColor: ui.pillBg }]}>
                <Text style={[os.statusPillText, { color: ui.pillText }]} numberOfLines={1}>
                  {pillLabel}
                </Text>
              </View>
              <Text style={os.codeMuted}>{formatDriverCode(item.driverId)}</Text>
            </View>
            <Text style={os.stitchCardTitle}>{item.displayName}</Text>
          </View>
          <View pointerEvents="none">
            <MaterialIcons name="local-shipping" size={22} color={S.outlineVariant} />
          </View>
        </View>
        {item.email ? (
          <Text style={os.stitchSubLine} numberOfLines={1}>
            {item.email}
          </Text>
        ) : null}
        <Text style={os.stitchMetaLine}>
          <Text style={os.stitchMetaBold}>{item.tripCount}</Text> chuyến trong phạm vi đã tải · Trạng thái gần nhất:{' '}
          {tripStatusVi(item.lastStatus)}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert('Chuyến gần nhất', `Trip ID: ${String(item.lastTripId)}`, [{ text: 'Đóng' }])
          }
          style={cardStyles.detailBtn}>
          <MaterialIcons name="info-outline" size={18} color={S.outline} />
          <Text style={cardStyles.detailBtnText}>Chi tiết ID chuyến</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DriversEditorialFooter({ driverCount, tripSum }: { driverCount: number; tripSum: number }) {
  return (
    <View style={os.editorialCard}>
      <LinearGradient
        colors={['#fff8e1', S.surfaceContainerLow]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={os.editorialVisual}>
        <MaterialIcons name="groups" size={44} color={S.primary} style={{ opacity: 0.35 }} />
      </LinearGradient>
      <View style={os.editorialBody}>
        <Text style={os.editorialEyebrow}>Tổng hợp</Text>
        <Text style={os.editorialTitle}>Tài xế từ chuyến hàng</Text>
        <Text style={os.editorialDesc}>
          Danh sách gom từ GET /trips (owner scope). Số chuyến là tổng trong các trang đã tải, không phải toàn bộ
          lịch sử hệ thống.
        </Text>
        <View style={os.editorialStats}>
          <View>
            <Text style={os.editorialStatNum}>{driverCount}</Text>
            <Text style={os.editorialStatCap}>Tài xế (sau lọc)</Text>
          </View>
          <View style={os.editorialStatDivider} />
          <View>
            <Text style={os.editorialStatNum}>{tripSum}</Text>
            <Text style={os.editorialStatCap}>Tổng chuyến (đã gom)</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function DriversScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  /** Owner dùng POST /owner/drivers; admin (nếu vào màn) dùng POST /users */
  const showAddDriver = Boolean(user);

  const handleAddDriver = useCallback(() => {
    if (user?.role === 'owner' || user?.role === 'admin') {
      router.push('/driver/form');
      return;
    }
    Alert.alert(
      'Thêm tài xế',
      'Đăng nhập bằng tài khoản Owner để dùng POST /owner/drivers, hoặc Admin để dùng POST /users.',
      [{ text: 'Đóng' }],
    );
  }, [user?.role, router]);

  const [tripStatus, setTripStatus] = useState('');
  const [drivers, setDrivers] = useState<AggregatedDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const skipStatusEffect = useRef(true);
  useFocusEffect(
    useCallback(() => {
      void initialLoad();
    }, [initialLoad]),
  );
  useEffect(() => {
    if (skipStatusEffect.current) {
      skipStatusEffect.current = false;
      return;
    }
    void initialLoad();
  }, [tripStatus, initialLoad]);

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

  const displayedDrivers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => {
      const name = d.displayName.toLowerCase();
      const email = (d.email ?? '').toLowerCase();
      const id = String(d.driverId).toLowerCase();
      return name.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [drivers, searchQuery]);

  const tripSum = useMemo(() => displayedDrivers.reduce((s, d) => s + d.tripCount, 0), [displayedDrivers]);

  const listHeader = useMemo(
    () => (
      <View style={os.mainHeader}>
        <Text style={os.eyebrow}>Dữ liệu thời gian thực</Text>
        <Text style={os.sectionTitle}>Tài xế</Text>
        {user?.role === 'owner' ? (
          <Text style={screenStyles.ownerHint}>
            Nhấn + để thêm tài xế (POST /owner/drivers). Danh sách gom từ chuyến (GET /trips).
          </Text>
        ) : null}
        <View style={os.heroSearchRow}>
          <View style={os.searchFieldWrap}>
            <MaterialIcons name="search" size={18} color={S.outline} style={os.searchFieldIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm tên, email, mã…"
              placeholderTextColor={`${S.outline}99`}
              style={os.searchFieldInput}
            />
          </View>
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={({ pressed }) => [os.filterCompact, pressed && os.filterBtnPressed]}>
            <MaterialIcons name="tune" size={20} color={S.primary} />
            <Text style={os.filterBtnText}>Lọc</Text>
          </Pressable>
        </View>
        {filtersOpen ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={os.chipsContent}>
            {TRIP_STATUS_FILTERS.map((f) => {
              const selected = tripStatus === f.value;
              return (
                <Pressable
                  key={f.value || 'all'}
                  onPress={() => setTripStatus(f.value)}
                  style={[os.chip, selected && os.chipSelected]}>
                  <Text style={[os.chipText, selected && os.chipTextSelected]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
    ),
    [filtersOpen, searchQuery, tripStatus, user?.role],
  );

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <MaterialIcons name="groups" size={26} color={Brand.forest} />
          <Text style={os.topTitleStitch} numberOfLines={1}>
            Tài xế
          </Text>
        </View>
        <View style={os.topBarRight}>
          {showAddDriver ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm tài xế"
              onPress={handleAddDriver}
              style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
              <MaterialIcons name="person-add" size={22} color={S.primary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
            <MaterialIcons name="filter-list" size={22} color={S.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
      <View style={os.hairline} />

      {error ? (
        <View style={os.centerBox}>
          <Text style={os.errorText}>{error}</Text>
          <Pressable onPress={() => void initialLoad()} style={os.retry}>
            <Text style={os.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={os.centerBox}>
          <ActivityIndicator size="large" color={S.primary} />
        </View>
      ) : (
        <View style={os.listWithFab} pointerEvents="box-none">
          <FlatList
            data={displayedDrivers}
            keyExtractor={(item) => item.key}
            ListHeaderComponent={listHeader}
            renderItem={({ item }) => <DriverCard item={item} />}
            contentContainerStyle={[os.listContent, showAddDriver && screenStyles.listContentFab]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.primary} />
            }
            ListEmptyComponent={
              !loading && !error ? (
                <Text style={os.empty}>
                  {searchQuery.trim()
                    ? 'Không có tài xế khớp tìm kiếm.'
                    : 'Chưa thấy tài xế từ chuyến hàng (trip không gắn driver hoặc chưa có dữ liệu).'}
                </Text>
              ) : null
            }
            ListFooterComponent={<DriversEditorialFooter driverCount={displayedDrivers.length} tripSum={tripSum} />}
            style={os.flatListFlex}
          />
          {showAddDriver ? (
            <TouchableOpacity
              onPress={handleAddDriver}
              activeOpacity={0.9}
              style={[screenStyles.fab, { bottom: insets.bottom + 56 }]}
              accessibilityRole="button"
              accessibilityLabel="Thêm tài xế">
              <LinearGradient
                colors={[S.primary, S.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={screenStyles.fabInner}>
                <MaterialIcons name="person-add" size={28} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}
