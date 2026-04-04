import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode, type ComponentProps } from 'react';
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

import { Brand } from '@/constants/brand';
import { getErrorMessage } from '@/lib/api/errors';
import { listHarvestAreas, updateHarvestArea } from '@/lib/api/harvest-areas';
import type { HarvestArea, HarvestAreaStatus } from '@/lib/types/ops';

const S = Brand.stitch;

const PAGE_SIZE = 15;

const STATUS_FILTERS: { value: '' | HarvestAreaStatus; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'preparing', label: 'Chuẩn bị' },
  { value: 'paused', label: 'Tạm dừng' },
  { value: 'awaiting_renewal', label: 'Chờ gia hạn' },
  { value: 'inactive', label: 'Ngưng' },
  { value: 'completed', label: 'Hoàn thành' },
];

function statusLabel(s: string): string {
  const f = STATUS_FILTERS.find((x) => x.value === s);
  return f?.label ?? s;
}

function harvestProgressPercent(id: string | number, status: string): number {
  const sid = String(id);
  const hash = sid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  switch (status) {
    case 'active':
      return 55 + (hash % 35);
    case 'completed':
      return 100;
    case 'paused':
    case 'awaiting_renewal':
      return 20 + (hash % 25);
    case 'preparing':
      return 10 + (hash % 20);
    case 'inactive':
      return 0;
    default:
      return 30 + (hash % 50);
  }
}

function formatNumberVi(n: number): string {
  return n.toLocaleString('vi-VN');
}

function formatKktCode(id: string | number): string {
  const n = String(id).replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `#KKT-${n}`;
}

/** API có thể trả status string hoặc { name: string } */
const HARVEST_STATUS_PARAM_VALUES: HarvestAreaStatus[] = [
  'inactive',
  'preparing',
  'active',
  'paused',
  'awaiting_renewal',
  'completed',
];

function parseHarvestStatusParam(raw: string | string[] | undefined): HarvestAreaStatus | null {
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!s) return null;
  const v = s.toLowerCase().trim() as HarvestAreaStatus;
  return HARVEST_STATUS_PARAM_VALUES.includes(v) ? v : null;
}

function normalizeHarvestStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type CardUi = {
  pillLabel: string;
  pillBg: string;
  pillText: string;
  accent: string;
  barColor: string;
  pctColor: string;
  mutedCard?: boolean;
};

function cardUiForStatus(status: string): CardUi {
  switch (status) {
    case 'active':
      return {
        pillLabel: 'Đang chạy',
        pillBg: S.secondaryContainer,
        pillText: S.onSecondaryContainer,
        accent: '#006d42',
        barColor: '#006d42',
        pctColor: '#006d42',
      };
    case 'preparing':
      return {
        pillLabel: 'Chờ',
        pillBg: S.surfaceContainerHigh,
        pillText: S.onSurfaceVariant,
        accent: `${S.outlineVariant}4d`,
        barColor: `${S.outlineVariant}4d`,
        pctColor: S.outline,
      };
    case 'paused':
      return {
        pillLabel: 'Tạm dừng',
        pillBg: S.tertiaryFixed,
        pillText: S.onTertiaryFixed,
        accent: S.tertiary,
        barColor: S.tertiary,
        pctColor: S.tertiary,
      };
    case 'completed':
      return {
        pillLabel: 'Hoàn thành',
        pillBg: S.outlineVariant,
        pillText: S.onSurfaceVariant,
        accent: S.outlineVariant,
        barColor: S.outline,
        pctColor: S.onSurfaceVariant,
        mutedCard: true,
      };
    case 'awaiting_renewal':
      return {
        pillLabel: 'Chờ gia hạn',
        pillBg: S.tertiaryFixed,
        pillText: S.onTertiaryFixed,
        accent: S.tertiary,
        barColor: S.tertiary,
        pctColor: S.tertiary,
      };
    default:
      return {
        pillLabel: statusLabel(status).toUpperCase(),
        pillBg: S.surfaceContainerHigh,
        pillText: S.onSurfaceVariant,
        accent: S.surfaceDim,
        barColor: S.onSurfaceVariant,
        pctColor: S.onSurfaceVariant,
      };
  }
}

function HarvestProgressCard({
  item,
  onDetail,
  patching,
  onPatch,
}: {
  item: HarvestArea;
  onDetail: () => void;
  patching: boolean;
  onPatch: (next: HarvestAreaStatus) => void;
}) {
  const st = normalizeHarvestStatus(item.status);
  const ui = cardUiForStatus(st);
  const pct = harvestProgressPercent(item.id, st);
  const target = item.targetTons != null ? Number(item.targetTons) : 0;
  const current = target > 0 ? Math.round((pct / 100) * target) : 0;
  const volLine =
    target > 0
      ? `${formatNumberVi(current)} / ${formatNumberVi(target)} tấn`
      : '— / — tấn';

  const primaryBtn = (label: string, icon: MaterialIconName, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={patching}
      activeOpacity={0.85}
      style={[styles.cardActionBtn, patching && styles.cardActionDisabled]}>
      <MaterialIcons name={icon} size={18} color={S.tertiary} />
      <Text style={[styles.cardActionLabel, { color: S.tertiary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const outlineBtn = (label: string, icon: MaterialIconName, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={patching}
      activeOpacity={0.85}
      style={[styles.cardActionBtn, patching && styles.cardActionDisabled]}>
      <MaterialIcons name={icon} size={18} color={S.outline} />
      <Text style={[styles.cardActionLabel, { color: S.outline }]}>{label}</Text>
    </TouchableOpacity>
  );

  const gradientBtn = (label: string, icon: MaterialIconName, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={patching}
      activeOpacity={0.88}
      style={[styles.cardActionGrow, patching && styles.cardActionDisabled]}>
      <LinearGradient
        colors={[S.primary, S.primaryContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardActionGradientInner}>
        <MaterialIcons name={icon} size={18} color="#fff" />
        <Text style={styles.cardActionGradientLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const detailOutlineBtn = (
    <TouchableOpacity onPress={onDetail} activeOpacity={0.85} style={styles.cardDetailWide}>
      <View style={styles.cardDetailWideLeft}>
        <MaterialIcons name="info-outline" size={18} color={S.outline} />
        <Text style={styles.cardDetailWideText}>Xem chi tiết</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={S.primary} />
    </TouchableOpacity>
  );

  let actions: ReactNode = null;
  if (st === 'active') {
    actions = (
      <View style={styles.cardActionsRow}>
        {primaryBtn('Tạm dừng', 'pause', () => onPatch('paused'))}
        {outlineBtn('Hoàn thành', 'check-circle', () => onPatch('completed'))}
      </View>
    );
  } else if (st === 'preparing') {
    actions = (
      <View style={styles.cardActionsRow}>
        {gradientBtn('Bắt đầu', 'play-arrow', () => onPatch('active'))}
      </View>
    );
  } else if (st === 'paused') {
    actions = (
      <View style={styles.cardActionsRow}>
        {gradientBtn('Tiếp tục', 'play-arrow', () => onPatch('active'))}
        {outlineBtn('Hoàn thành', 'check-circle', () => onPatch('completed'))}
      </View>
    );
  } else if (st === 'completed') {
    actions = detailOutlineBtn;
  } else {
    actions = detailOutlineBtn;
  }

  return (
    <View style={[styles.stitchCard, ui.mutedCard && styles.stitchCardMuted]}>
      <View style={[styles.stitchAccent, { backgroundColor: ui.accent }]} pointerEvents="none" />
      <View style={styles.stitchCardInner}>
        <View style={styles.stitchCardHeader}>
          <View style={styles.stitchTitleBlock}>
            <View style={styles.stitchPillRow}>
              <View style={[styles.statusPill, { backgroundColor: ui.pillBg }]}>
                <Text style={[styles.statusPillText, { color: ui.pillText }]}>{ui.pillLabel}</Text>
              </View>
              <Text style={styles.kktCode}>{formatKktCode(item.id)}</Text>
            </View>
            <Text style={[styles.stitchCardTitle, ui.mutedCard && styles.stitchCardTitleMuted]}>
              {item.name}
            </Text>
          </View>
          <View pointerEvents="none">
            <MaterialIcons name="more-vert" size={22} color={S.outlineVariant} />
          </View>
        </View>

        {st === 'paused' && item.siteNotes ? (
          <View style={styles.warningBanner}>
            <MaterialIcons name="warning" size={16} color={S.tertiaryContainer} />
            <Text style={styles.warningText} numberOfLines={2}>
              {String(item.siteNotes)}
            </Text>
          </View>
        ) : null}

        <View style={styles.stitchProgressBlock}>
          <View style={styles.stitchProgressTop}>
            <Text style={styles.stitchVolLine}>
              <Text style={styles.stitchVolMuted}>Sản lượng: </Text>
              <Text style={styles.stitchVolBold}>{volLine}</Text>
            </Text>
            <Text style={[styles.stitchPct, { color: ui.pctColor }]}>{pct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              pointerEvents="none"
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  backgroundColor: ui.barColor,
                },
              ]}
            />
          </View>
        </View>

        {actions}
        {st === 'active' || st === 'preparing' || st === 'paused' ? (
          <View style={styles.cardDetailBelowActions}>{detailOutlineBtn}</View>
        ) : null}
      </View>
    </View>
  );
}

function EditorialFooter({ runningCount, totalTargetTons }: { runningCount: number; totalTargetTons: number }) {
  return (
    <View style={styles.editorialCard}>
      <LinearGradient
        colors={['#e8f5e9', S.surfaceContainerLow]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.editorialVisual}>
        <MaterialIcons name="park" size={48} color={Brand.forest} style={{ opacity: 0.35 }} />
      </LinearGradient>
      <View style={styles.editorialBody}>
        <Text style={styles.editorialEyebrow}>Thông tin vận hành</Text>
        <Text style={styles.editorialTitle}>Quy trình khai thác bền vững KeoTram</Text>
        <Text style={styles.editorialDesc}>
          Các khu được giám sát theo phạm vi tài khoản của bạn; cập nhật trạng thái trực tiếp trên thẻ hoặc chỉnh
          sửa chi tiết khi cần.
        </Text>
        <View style={styles.editorialStats}>
          <View>
            <Text style={styles.editorialStatNum}>{runningCount}</Text>
            <Text style={styles.editorialStatCap}>Khu đang chạy</Text>
          </View>
          <View style={styles.editorialStatDivider} />
          <View>
            <Text style={styles.editorialStatNum}>
              {totalTargetTons >= 1000
                ? `${(totalTargetTons / 1000).toFixed(1).replace('.', ',')}k`
                : formatNumberVi(totalTargetTons)}
            </Text>
            <Text style={styles.editorialStatCap}>Tấn mục tiêu (tổng)</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function HarvestAreasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status: statusParam } = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState<'' | HarvestAreaStatus>('');

  useEffect(() => {
    const p = parseHarvestStatusParam(statusParam);
    if (statusParam != null && String(statusParam).length > 0 && p != null) {
      setStatus(p);
    }
  }, [statusParam]);
  const [items, setItems] = useState<HarvestArea[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [patchingId, setPatchingId] = useState<string | number | null>(null);

  const filters = useMemo(() => (status ? { status } : undefined), [status]);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const res = await listHarvestAreas({
        page: nextPage,
        limit: PAGE_SIZE,
        filters,
      });
      if (append) {
        setItems((prev) => [...prev, ...res.data]);
      } else {
        setItems(res.data);
      }
      setHasNext(res.hasNextPage);
      setPage(nextPage);
    },
    [filters],
  );

  const initialLoad = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loadPage(1, false);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được danh sách'));
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      void initialLoad();
    }, [initialLoad]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadPage(1, false);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được danh sách'));
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const onEndReached = useCallback(async () => {
    if (!hasNext || loadingMore || loading) {
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
  }, [hasNext, loadPage, loadingMore, loading, page]);

  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const runningCount = useMemo(
    () => items.filter((i) => normalizeHarvestStatus(i.status) === 'active').length,
    [items],
  );
  const totalTargetTons = useMemo(
    () => items.reduce((s, i) => s + (Number(i.targetTons) || 0), 0),
    [items],
  );

  const patchStatus = useCallback(
    async (id: string | number, next: HarvestAreaStatus) => {
      setPatchingId(id);
      try {
        await updateHarvestArea(id, { status: next });
        await loadPage(1, false);
      } catch (e) {
        Alert.alert('Lỗi', getErrorMessage(e, 'Không cập nhật được trạng thái'));
      } finally {
        setPatchingId(null);
      }
    },
    [loadPage],
  );

  const confirmPatch = useCallback(
    (id: string | number, next: HarvestAreaStatus, title: string) => {
      Alert.alert(title, 'Bạn có chắc muốn đổi trạng thái khu này?', [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xác nhận', onPress: () => void patchStatus(id, next) },
      ]);
    },
    [patchStatus],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.mainHeader}>
        <Text style={styles.eyebrow}>Dữ liệu thời gian thực</Text>
        <Text style={styles.sectionTitle}>Khu vực khai thác</Text>
        <View style={styles.heroSearchRow}>
          <View style={styles.searchFieldWrap}>
            <MaterialIcons name="search" size={18} color={S.outline} style={styles.searchFieldIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm mã khu..."
              placeholderTextColor={`${S.outline}99`}
              style={styles.searchFieldInput}
            />
          </View>
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={({ pressed }) => [styles.filterCompact, pressed && styles.filterBtnPressed]}>
            <MaterialIcons name="tune" size={20} color={S.primary} />
            <Text style={styles.filterBtnText}>Lọc</Text>
          </Pressable>
        </View>
        {filtersOpen ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}>
            {STATUS_FILTERS.map((f) => {
              const selected = status === f.value;
              return (
                <Pressable
                  key={f.value || 'all'}
                  onPress={() => setStatus(f.value)}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
    ),
    [filtersOpen, searchQuery, status],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.topBarLeft}>
          <MaterialIcons name="park" size={26} color={Brand.forest} />
          <Text style={styles.topTitleStitch}>Quản lý Khai thác</Text>
        </View>
        <View style={styles.topBarRight}>
          <Pressable
            onPress={() => router.push('/weighing-stations-map')}
            accessibilityRole="button"
            accessibilityLabel="Mở bản đồ trạm cân"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <MaterialIcons name="map" size={22} color={S.onSurfaceVariant} />
          </Pressable>
          <Pressable
            onPress={() => {
              /* focus search: user types in field below */
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <MaterialIcons name="search" size={22} color={S.onSurfaceVariant} />
          </Pressable>
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <MaterialIcons name="filter-list" size={22} color={S.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
      <View style={styles.hairline} />

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
          <ActivityIndicator size="large" color={S.primary} />
        </View>
      ) : (
        <View style={styles.listWithFab} pointerEvents="box-none">
          <FlatList
            data={displayedItems}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={listHeader}
            renderItem={({ item }) => (
              <HarvestProgressCard
                item={item}
                patching={patchingId != null && String(patchingId) === String(item.id)}
                onDetail={() => router.push(`/harvest-area/${String(item.id)}`)}
                onPatch={(next) => {
                  if (next === 'completed' || next === 'paused') {
                    confirmPatch(item.id, next, 'Đổi trạng thái');
                  } else {
                    void patchStatus(item.id, next);
                  }
                }}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.primary} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.35}
            ListEmptyComponent={
              !loading && !error ? (
                <Text style={styles.empty}>
                  {searchQuery.trim()
                    ? 'Không có khu khớp tìm kiếm.'
                    : 'Chưa có khu nào. Nhấn + để thêm khu.'}
                </Text>
              ) : null
            }
            ListFooterComponent={
              <>
                {loadingMore ? (
                  <ActivityIndicator style={styles.footerLoader} color={S.primary} />
                ) : null}
                <EditorialFooter runningCount={runningCount} totalTargetTons={totalTargetTons} />
              </>
            }
            style={styles.flatListFlex}
          />
          <TouchableOpacity
            onPress={() => router.push('/harvest-area/form')}
            activeOpacity={0.9}
            style={[styles.fab, { bottom: insets.bottom + 56 }]}
            accessibilityRole="button"
            accessibilityLabel="Thêm khu khai thác">
            <LinearGradient
              colors={[S.primary, S.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabInner}>
              <MaterialIcons name="add" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  listWithFab: {
    flex: 1,
  },
  flatListFlex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: Brand.canvas,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topTitleStitch: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: Brand.forest,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: S.surfaceContainerLow,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: S.surfaceContainerLow,
    width: '100%',
  },
  mainHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: Brand.ink,
  },
  heroSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 4,
  },
  searchFieldWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 8,
    paddingLeft: 10,
    minHeight: 40,
  },
  searchFieldIcon: {
    marginRight: 4,
  },
  searchFieldInput: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    fontSize: 14,
    color: Brand.ink,
  },
  filterCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: S.surfaceContainerHigh,
  },
  filterBtnPressed: {
    opacity: 0.92,
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: S.primary,
  },
  chipsContent: {
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.chipMuted,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: S.primary,
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
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
  stitchCard: {
    backgroundColor: Brand.surface,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  stitchCardMuted: {
    opacity: 0.88,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}26`,
  },
  stitchAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  stitchCardInner: {
    padding: 24,
    paddingLeft: 20,
  },
  stitchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stitchTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  stitchPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  kktCode: {
    fontSize: 12,
    fontWeight: '500',
    color: S.onSurfaceVariant,
  },
  stitchCardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Brand.ink,
  },
  stitchCardTitleMuted: {
    color: S.onSurfaceVariant,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${S.tertiaryFixed}4d`,
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: S.tertiaryContainer,
  },
  stitchProgressBlock: {
    gap: 8,
    marginBottom: 16,
  },
  stitchProgressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  stitchVolLine: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  stitchVolMuted: {
    color: S.onSurfaceVariant,
    fontWeight: '500',
  },
  stitchVolBold: {
    color: Brand.ink,
    fontWeight: '700',
  },
  stitchPct: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: S.surfaceContainerLow,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: S.surfaceContainerHigh,
  },
  cardActionDisabled: {
    opacity: 0.5,
  },
  cardActionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardActionGrow: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardActionGradientInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  cardActionGradientLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cardDetailWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}40`,
  },
  cardDetailWideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  cardDetailWideText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.outline,
  },
  cardDetailBelowActions: {
    marginTop: 10,
  },
  editorialCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: Brand.surface,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 2,
  },
  editorialVisual: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorialBody: {
    padding: 24,
  },
  editorialEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: S.primary,
    marginBottom: 8,
  },
  editorialTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Brand.ink,
    marginBottom: 12,
    lineHeight: 28,
  },
  editorialDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: S.onSurfaceVariant,
    marginBottom: 20,
  },
  editorialStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  editorialStatNum: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.ink,
  },
  editorialStatCap: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: S.outline,
    marginTop: 4,
  },
  editorialStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: `${S.outlineVariant}4d`,
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
    backgroundColor: S.primary,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: Brand.inkMuted,
    marginTop: 32,
    paddingHorizontal: 16,
  },
  footerLoader: {
    marginVertical: 16,
  },
});
