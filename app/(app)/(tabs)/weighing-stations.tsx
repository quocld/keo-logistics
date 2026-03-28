import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { listWeighingStations } from '@/lib/api/weighing-stations';
import type { WeighingStation } from '@/lib/types/ops';

const S = Brand.stitch;

const PAGE_SIZE = 15;

function normalizeStationStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

function formatStationCode(id: string | number): string {
  const n = String(id).replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `#TCN-${n}`;
}

function stationAccent(st: string): string {
  if (st.includes('active') || st === '1') return S.primary;
  if (st.includes('inactive') || st.includes('disabled')) return S.outlineVariant;
  if (st) return S.primaryContainer;
  return S.primary;
}

function WeighingStationCard({
  item,
  onPress,
}: {
  item: WeighingStation;
  onPress: () => void;
}) {
  const st = normalizeStationStatus(item.status);
  const accent = stationAccent(st);
  const price =
    item.unitPrice != null
      ? `${Number(item.unitPrice).toLocaleString('vi-VN')} VND/tấn`
      : '—';

  return (
    <Pressable onPress={onPress} style={os.stitchCard}>
      <View style={[os.stitchAccent, { backgroundColor: accent }]} pointerEvents="none" />
      <View style={os.stitchCardInner}>
        <View style={os.stitchCardHeader}>
          <View style={os.stitchTitleBlock}>
            <View style={os.stitchPillRow}>
              {st ? (
                <View style={[os.statusPill, { backgroundColor: S.secondaryContainer }]}>
                  <Text style={[os.statusPillText, { color: S.onSecondaryContainer }]} numberOfLines={1}>
                    {st.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View style={[os.statusPill, { backgroundColor: S.surfaceContainerHigh }]}>
                  <Text style={[os.statusPillText, { color: S.onSurfaceVariant }]}>TRẠM</Text>
                </View>
              )}
              <Text style={os.codeMuted}>{formatStationCode(item.id)}</Text>
            </View>
            <Text style={os.stitchCardTitle}>{item.name}</Text>
          </View>
          {item.code ? (
            <View pointerEvents="none" style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{item.code}</Text>
            </View>
          ) : null}
        </View>
        <Text style={os.stitchMetaLine}>
          <Text style={os.stitchMetaBold}>{price}</Text>
        </Text>
        {item.formattedAddress ? (
          <Text style={os.stitchSubLine} numberOfLines={3}>
            {item.formattedAddress}
          </Text>
        ) : null}
        {item.notes ? (
          <Text style={os.stitchSubLine} numberOfLines={2}>
            {String(item.notes)}
          </Text>
        ) : null}
        <View style={styles.cardActionRow} pointerEvents="none">
          <Text style={styles.cardActionLabel}>Xem chi tiết trạm</Text>
          <MaterialIcons name="chevron-right" size={22} color={S.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function WeighingEditorialFooter({
  count,
  withPrice,
}: {
  count: number;
  withPrice: number;
}) {
  return (
    <View style={os.editorialCard}>
      <LinearGradient
        colors={['#e3f2fd', S.surfaceContainerLow]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={os.editorialVisual}>
        <MaterialIcons name="scale" size={44} color={S.primary} style={{ opacity: 0.35 }} />
      </LinearGradient>
      <View style={os.editorialBody}>
        <Text style={os.editorialEyebrow}>Vận hành</Text>
        <Text style={os.editorialTitle}>Trạm cân & đơn giá theo tấn</Text>
        <Text style={os.editorialDesc}>
          Đơn giá cấu hình tại trạm dùng khi duyệt phiếu; danh sách theo phạm vi tài khoản của bạn.
        </Text>
        <View style={os.editorialStats}>
          <View>
            <Text style={os.editorialStatNum}>{count}</Text>
            <Text style={os.editorialStatCap}>Trạm (đã tải)</Text>
          </View>
          <View style={os.editorialStatDivider} />
          <View>
            <Text style={os.editorialStatNum}>{withPrice}</Text>
            <Text style={os.editorialStatCap}>Có đơn giá</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function WeighingStationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<WeighingStation[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

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

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      const s = normalizeStationStatus(i.status);
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [items]);

  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = items;
    if (statusFilter) {
      list = list.filter((i) => normalizeStationStatus(i.status) === statusFilter);
    }
    if (!q) return list;
    return list.filter((i) => {
      const name = (i.name ?? '').toLowerCase();
      const code = (i.code ?? '').toLowerCase();
      const addr = (i.formattedAddress ?? '').toLowerCase();
      return name.includes(q) || code.includes(q) || addr.includes(q);
    });
  }, [items, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const withPrice = items.filter((i) => i.unitPrice != null).length;
    return { count: items.length, withPrice };
  }, [items]);

  const listHeader = useMemo(
    () => (
      <View style={os.mainHeader}>
        <Text style={os.eyebrow}>Dữ liệu thời gian thực</Text>
        <Text style={os.sectionTitle}>Trạm cân</Text>
        <Text style={fabStyles.listHint}>Nhấn + để thêm trạm (POST /weighing-stations).</Text>
        <View style={os.heroSearchRow}>
          <View style={os.searchFieldWrap}>
            <MaterialIcons name="search" size={18} color={S.outline} style={os.searchFieldIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm tên, mã, địa chỉ…"
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
            <Pressable
              onPress={() => setStatusFilter('')}
              style={[os.chip, !statusFilter && os.chipSelected]}>
              <Text style={[os.chipText, !statusFilter && os.chipTextSelected]}>Tất cả</Text>
            </Pressable>
            {statusOptions.map((s) => {
              const selected = statusFilter === s;
              return (
                <Pressable key={s} onPress={() => setStatusFilter(s)} style={[os.chip, selected && os.chipSelected]}>
                  <Text style={[os.chipText, selected && os.chipTextSelected]}>{s}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
    ),
    [filtersOpen, searchQuery, statusFilter, statusOptions],
  );

  if (forbidden && !loading) {
    return (
      <View style={os.root}>
        <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={os.topBarLeft}>
            <MaterialIcons name="scale" size={26} color={Brand.forest} />
            <Text style={os.topTitleStitch} numberOfLines={1}>
              Trạm cân
            </Text>
          </View>
        </View>
        <View style={os.hairline} />
        <View style={os.blockedCard}>
          <LinearGradient
            colors={[`${S.tertiaryFixed}80`, S.surfaceContainerLow]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="lock-outline" size={40} color={S.tertiary} style={{ opacity: 0.5 }} />
          </LinearGradient>
          <View style={os.blockedBody}>
            <Text style={os.blockedTitle}>Không có quyền xem</Text>
            <Text style={os.blockedText}>
              Backend trả 403 — danh sách trạm cân có thể chỉ dành cho admin. Dùng Admin Dashboard hoặc yêu cầu mở
              quyền đọc cho owner.
            </Text>
            <Pressable onPress={() => void initialLoad()} style={os.retry}>
              <Text style={os.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <MaterialIcons name="scale" size={26} color={Brand.forest} />
          <Text style={os.topTitleStitch} numberOfLines={1}>
            Trạm cân
          </Text>
        </View>
        <View style={os.topBarRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm trạm cân"
            onPress={() => router.push('/weighing-station/form')}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
            <MaterialIcons name="add" size={26} color={S.primary} />
          </Pressable>
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
            data={displayedItems}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={listHeader}
            renderItem={({ item }) => (
              <WeighingStationCard
                item={item}
                onPress={() => router.push(`/weighing-station/${String(item.id)}`)}
              />
            )}
            contentContainerStyle={[os.listContent, fabStyles.listContentFab]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.primary} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.35}
            ListEmptyComponent={
              !loading && !error ? (
                <Text style={os.empty}>
                  {searchQuery.trim() || statusFilter
                    ? 'Không có trạm khớp bộ lọc.'
                    : 'Chưa có trạm cân. Nhấn + để thêm trạm.'}
                </Text>
              ) : null
            }
            ListFooterComponent={
              <>
                {loadingMore ? <ActivityIndicator style={os.footerLoader} color={S.primary} /> : null}
                <WeighingEditorialFooter count={stats.count} withPrice={stats.withPrice} />
              </>
            }
            style={os.flatListFlex}
          />
          <TouchableOpacity
            onPress={() => router.push('/weighing-station/form')}
            activeOpacity={0.9}
            style={[fabStyles.fab, { bottom: insets.bottom + 56 }]}
            accessibilityRole="button"
            accessibilityLabel="Thêm trạm cân">
            <LinearGradient
              colors={[S.primary, S.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={fabStyles.fabInner}>
              <MaterialIcons name="add" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const fabStyles = StyleSheet.create({
  listHint: {
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

const styles = StyleSheet.create({
  codeBadge: {
    backgroundColor: S.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: S.primary,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginLeft: -20,
    marginRight: -24,
    marginBottom: -24,
    paddingVertical: 14,
    paddingLeft: 20,
    paddingRight: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.outlineVariant,
    backgroundColor: `${S.primary}0a`,
  },
  cardActionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: S.primary,
    letterSpacing: -0.1,
  },
});
