import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { getErrorMessage } from '@/lib/api/errors';
import { listVehicles } from '@/lib/api/vehicles';
import type { OwnerVehicleRow, OwnerVehicleStatus } from '@/lib/types/ops';

const S = Brand.stitch;

const STATUS_FILTERS: { value: '' | OwnerVehicleStatus; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'running', label: 'Đang chạy' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'idle', label: 'Nghỉ / chờ' },
];

function statusLabelVi(s: OwnerVehicleStatus): string {
  const f = STATUS_FILTERS.find((x) => x.value === s);
  return f?.label ?? s;
}

function statusUi(s: OwnerVehicleStatus): { accent: string; pillBg: string; pillText: string } {
  switch (s) {
    case 'running':
      return {
        accent: S.primary,
        pillBg: S.secondaryContainer,
        pillText: S.onSecondaryContainer,
      };
    case 'maintenance':
      return {
        accent: S.tertiary,
        pillBg: S.tertiaryFixed,
        pillText: S.onTertiaryFixed,
      };
    case 'idle':
    default:
      return {
        accent: `${S.outlineVariant}cc`,
        pillBg: S.surfaceContainerHigh,
        pillText: S.onSurfaceVariant,
      };
  }
}

/** Minh họa theo flow quản lý đội xe — GET /owner/vehicles (hoặc tương đương) sẽ thay thế. */
const DEMO_VEHICLES: OwnerVehicleRow[] = [
  {
    id: 'v1',
    plate: '51H-812.34',
    modelLabel: 'Howo T5G · 3 chân',
    status: 'running',
    driverName: 'Trần Văn Hùng',
    driverId: 12,
    capacityTons: 15,
    note: 'Đang chuyến — khai thác Bắc Tân',
  },
  {
    id: 'v2',
    plate: '51H-445.91',
    modelLabel: 'Chenglong H7 · Mooc lùn',
    status: 'running',
    driverName: 'Lê Thị Mai',
    driverId: 18,
    capacityTons: 18,
    note: 'Chờ dỡ tại trạm Phú Mỹ',
  },
  {
    id: 'v3',
    plate: '47B-102.33',
    modelLabel: 'Fuso Fighter',
    status: 'maintenance',
    driverName: null,
    driverId: null,
    capacityTons: 8,
    note: 'Bảo dưỡng định kỳ — dự kiến 02/04',
  },
  {
    id: 'v4',
    plate: '51H-200.77',
    modelLabel: 'Howo A7',
    status: 'idle',
    driverName: 'Phạm Quốc Anh',
    driverId: 9,
    capacityTons: 16,
    note: 'Xe rảnh — có thể điều phối',
  },
  {
    id: 'v5',
    plate: '51F-909.05',
    modelLabel: 'Daewoo Prima',
    status: 'idle',
    driverName: null,
    driverId: null,
    capacityTons: 12,
    note: 'Chưa gán tài xế',
  },
];

const screenStyles = StyleSheet.create({
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
  ownerHint: {
    fontSize: 13,
    lineHeight: 19,
    color: `${S.outline}b3`,
    marginTop: 8,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    marginBottom: 4,
  },
  statTile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Brand.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}aa`,
  },
  statTileHighlight: {
    borderColor: `${S.primary}55`,
    backgroundColor: `${S.primary}08`,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.5,
  },
  statLab: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: S.onSurfaceVariant,
    textTransform: 'uppercase',
  },
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

function VehicleCard({
  item,
  onPressDetail,
}: {
  item: OwnerVehicleRow;
  onPressDetail: (id: string) => void;
}) {
  const ui = statusUi(item.status);
  const pill = statusLabelVi(item.status).toUpperCase();

  return (
    <View style={os.stitchCard}>
      <View style={[os.stitchAccent, { backgroundColor: ui.accent }]} pointerEvents="none" />
      <View style={os.stitchCardInner}>
        <View style={os.stitchCardHeader}>
          <View style={os.stitchTitleBlock}>
            <View style={os.stitchPillRow}>
              <View style={[os.statusPill, { backgroundColor: ui.pillBg }]}>
                <Text style={[os.statusPillText, { color: ui.pillText }]} numberOfLines={1}>
                  {pill}
                </Text>
              </View>
              <Text style={os.codeMuted}>{item.capacityTons} tấn</Text>
            </View>
            <Text style={os.stitchCardTitle}>{item.plate}</Text>
          </View>
          <View style={{ opacity: 0.9 }} pointerEvents="none">
            <MaterialIcons name="local-shipping" size={26} color={S.outlineVariant} />
          </View>
        </View>
        <Text style={os.stitchSubLine} numberOfLines={2}>
          {item.modelLabel}
        </Text>
        <Text style={os.stitchMetaLine}>
          {item.driverName ? (
            <>
              Tài xế: <Text style={os.stitchMetaBold}>{item.driverName}</Text>
              {item.driverId != null ? ` · #${String(item.driverId)}` : null}
            </>
          ) : (
            <Text style={{ color: S.outline }}>Chưa gán tài xế</Text>
          )}
        </Text>
        <Text style={[os.stitchMetaLine, { marginTop: 6 }]} numberOfLines={2}>
          {item.note}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onPressDetail(item.id)}
          style={screenStyles.detailBtn}>
          <MaterialIcons name="info-outline" size={18} color={S.outline} />
          <Text style={screenStyles.detailBtnText}>Chi tiết & lịch sử</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function VehiclesEditorialFooter({ total }: { total: number }) {
  return (
    <View style={os.editorialCard}>
      <LinearGradient
        colors={['#e8f5ec', S.surfaceContainerLow]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={os.editorialVisual}>
        <MaterialIcons name="directions-car" size={44} color={S.primary} style={{ opacity: 0.35 }} />
      </LinearGradient>
      <View style={os.editorialBody}>
        <Text style={os.editorialEyebrow}>Đội xe</Text>
        <Text style={os.editorialTitle}>Quản lý phương tiện</Text>
        <Text style={os.editorialDesc}>
          Danh sách và trạng thái minh họa theo giao diện Stitch. Khi backend có endpoint (ví dụ GET /owner/vehicles),
          chỉ cần thay nguồn dữ liệu trong màn này.
        </Text>
        <View style={os.editorialStats}>
          <View>
            <Text style={os.editorialStatNum}>{total}</Text>
            <Text style={os.editorialStatCap}>Xe (sau lọc)</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [vehicles, setVehicles] = useState<OwnerVehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | OwnerVehicleStatus>('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await listVehicles({ page: 1, limit: 200 });
    const rows: OwnerVehicleRow[] = res.data.map((v) => {
      const driverName =
        (v.assignedDriver?.firstName || v.assignedDriver?.lastName
          ? `${v.assignedDriver?.firstName ?? ''} ${v.assignedDriver?.lastName ?? ''}`.trim()
          : v.assignedDriver?.email) ?? null;
      const driverId = v.assignedDriver?.id ?? v.assignedDriverId ?? null;
      const status: OwnerVehicleStatus = ((): OwnerVehicleStatus => {
        const s = String(v.status ?? '').toLowerCase();
        if (s === 'maintenance') return 'maintenance';
        if (s === 'running') return 'running';
        return 'idle';
      })();
      return {
        id: String(v.id),
        plate: v.plate,
        modelLabel: String(v.name ?? 'Phương tiện'),
        status,
        driverName,
        driverId,
        capacityTons: Number((v as { capacityTons?: unknown }).capacityTons ?? 0) || 0,
        note: '',
      };
    });
    setVehicles(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          Alert.alert('Lỗi', getErrorMessage(e, 'Không tải được danh sách xe'));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tải được danh sách xe'));
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const filtered = useMemo(() => {
    let rows = vehicles;
    if (statusFilter) {
      rows = rows.filter((v) => v.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((v) => {
      return (
        v.plate.toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        v.modelLabel.toLowerCase().includes(q) ||
        (v.driverName?.toLowerCase().includes(q) ?? false) ||
        String(v.driverId ?? '').includes(q)
      );
    });
  }, [vehicles, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    const base = filtered;
    return {
      total: base.length,
      running: base.filter((v) => v.status === 'running').length,
      maintenance: base.filter((v) => v.status === 'maintenance').length,
      idle: base.filter((v) => v.status === 'idle').length,
    };
  }, [filtered]);

  const listHeader = useMemo(
    () => (
      <View style={os.mainHeader}>
        <Text style={os.eyebrow}>Vận hành</Text>
        <Text style={os.sectionTitle}>Phương tiện</Text>
        {isOwner ? (
          <Text style={screenStyles.ownerHint}>
            Theo dõi biển số, tải trọng và trạng thái từng xe. Thêm xe mới khi API sẵn sàng.
          </Text>
        ) : null}
        <View style={screenStyles.statsRow}>
          <View style={[screenStyles.statTile, screenStyles.statTileHighlight]}>
            <Text style={screenStyles.statVal}>{counts.total}</Text>
            <Text style={screenStyles.statLab}>Tổng (lọc)</Text>
          </View>
          <View style={screenStyles.statTile}>
            <Text style={screenStyles.statVal}>{counts.running}</Text>
            <Text style={screenStyles.statLab}>Đang chạy</Text>
          </View>
          <View style={screenStyles.statTile}>
            <Text style={screenStyles.statVal}>{counts.maintenance}</Text>
            <Text style={screenStyles.statLab}>Bảo trì</Text>
          </View>
          <View style={screenStyles.statTile}>
            <Text style={screenStyles.statVal}>{counts.idle}</Text>
            <Text style={screenStyles.statLab}>Nghỉ / chờ</Text>
          </View>
        </View>
        <View style={os.heroSearchRow}>
          <View style={os.searchFieldWrap}>
            <MaterialIcons name="search" size={18} color={S.outline} style={os.searchFieldIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Biển số, dòng xe, tài xế…"
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
            {STATUS_FILTERS.map((f) => {
              const selected = statusFilter === f.value;
              return (
                <Pressable
                  key={f.value || 'all'}
                  onPress={() => setStatusFilter(f.value)}
                  style={[os.chip, selected && os.chipSelected]}>
                  <Text style={[os.chipText, selected && os.chipTextSelected]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
    ),
    [counts, filtersOpen, isOwner, searchQuery, statusFilter],
  );

  const onAddVehicle = useCallback(() => {
    router.push('/vehicle/form');
  }, [router]);

  const onPressDetail = useCallback(
    (id: string) => {
      router.push(`/vehicle/${encodeURIComponent(id)}`);
    },
    [router],
  );

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <MaterialIcons name="directions-car" size={26} color={Brand.forest} />
          <Text style={os.topTitleStitch} numberOfLines={1}>
            Phương tiện
          </Text>
        </View>
        <View style={os.topBarRight}>
          {isOwner ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm phương tiện"
              onPress={onAddVehicle}
              style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
              <MaterialIcons name="add" size={26} color={S.primary} />
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

      {loading && !refreshing ? (
        <View style={os.centerBox}>
          <ActivityIndicator size="large" color={S.primary} />
        </View>
      ) : (
        <View style={os.listWithFab} pointerEvents="box-none">
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={listHeader}
            renderItem={({ item }) => <VehicleCard item={item} onPressDetail={onPressDetail} />}
            contentContainerStyle={[os.listContent, isOwner && screenStyles.listContentFab]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.primary} />
            }
            ListEmptyComponent={
              <Text style={os.empty}>
                {searchQuery.trim() || statusFilter
                  ? 'Không có phương tiện khớp bộ lọc.'
                  : 'Chưa có dữ liệu xe.'}
              </Text>
            }
            ListFooterComponent={<VehiclesEditorialFooter total={filtered.length} />}
            style={os.flatListFlex}
          />
          {isOwner ? (
            <TouchableOpacity
              onPress={onAddVehicle}
              activeOpacity={0.9}
              style={[screenStyles.fab, { bottom: insets.bottom + 56 }]}
              accessibilityRole="button"
              accessibilityLabel="Thêm phương tiện">
              <LinearGradient
                colors={[S.primary, S.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={screenStyles.fabInner}>
                <MaterialIcons name="add" size={30} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}
