import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stitchHarvestFormStyles as headerStyles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import {
  deleteHarvestArea,
  getHarvestArea,
  getHarvestAreaDrivers,
  getHarvestAreaReceiptSummary,
  listHarvestAreaReceipts,
} from '@/lib/api/harvest-areas';
import {
  appendHarvestAreaForOwnerDriver,
  listAllOwnerDrivers,
  removeHarvestAreaFromOwnerDriver,
} from '@/lib/api/owner-drivers';
import { aggregateDriversFromTrips, listTrips } from '@/lib/api/trips';
import { formatReceiptDateAndTimeVi } from '@/lib/date/vi-receipt-time';
import { formatVndShortVi } from '@/lib/format/vnd-vi';
import type { HarvestArea, OwnerDriverUser, Receipt, Trip } from '@/lib/types/ops';

const S = Brand.stitch;

const RECEIPTS_PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  inactive: 'Ngưng',
  preparing: 'Chuẩn bị',
  active: 'Hoạt động',
  paused: 'Tạm dừng',
  awaiting_renewal: 'Chờ gia hạn',
  completed: 'Hoàn thành',
};

function normalizeHarvestStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

function statusHeadlineVi(st: string): string {
  if (st === 'active') return 'Đang khai thác';
  const mapped = STATUS_LABELS[st];
  if (mapped) return mapped;
  if (!st) return '—';
  return st.replace(/_/g, ' ');
}

function formatAreaRegionCode(id: string | number): string {
  return `KKT-${String(id).slice(-8).toUpperCase()}`;
}

function pillColorsForStatus(st: string): { bg: string; fg: string } {
  switch (st) {
    case 'active':
      return { bg: S.secondaryContainer, fg: S.onSecondaryContainer };
    case 'completed':
      return { bg: `${S.primary}22`, fg: S.primary };
    case 'paused':
    case 'awaiting_renewal':
      return { bg: S.tertiaryFixed, fg: S.onTertiaryFixed };
    case 'preparing':
      return { bg: S.surfaceContainerHigh, fg: S.onSurfaceVariant };
    case 'inactive':
      return { bg: S.surfaceDim, fg: S.onSurfaceVariant };
    default:
      return { bg: S.surfaceContainerHigh, fg: S.onSurfaceVariant };
  }
}

function receiptStatusLabelVi(raw: unknown): string {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (!s) return '—';
  if (s.includes('pending')) return 'Chờ duyệt';
  if (s.includes('approved')) return 'Đã duyệt';
  if (s.includes('reject')) return 'Từ chối';
  return String(raw).replace(/_/g, ' ');
}

function receiptStatusUi(raw: unknown): { label: string; bg: string; fg: string } {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (s.includes('approved')) {
    return { label: 'Đã duyệt', bg: `${S.primary}22`, fg: S.primary };
  }
  if (s.includes('pending')) {
    return { label: 'Chờ duyệt', bg: `${Brand.ink}0f`, fg: Brand.inkMuted };
  }
  if (s.includes('reject')) {
    return { label: 'Từ chối', bg: '#ffebee', fg: '#b71c1c' };
  }
  return {
    label: receiptStatusLabelVi(raw),
    bg: S.surfaceContainerHigh,
    fg: S.onSurfaceVariant,
  };
}

function formatReceiptAmountVnd(r: Receipt): string {
  const a = r.amount;
  if (a == null || !Number.isFinite(Number(a))) return '—';
  return `${Number(a).toLocaleString('vi-VN')} đ`;
}

function receiptWeightLine(r: Receipt): string {
  const w = r.weight;
  if (w != null && Number.isFinite(Number(w))) {
    return `${Number(w).toLocaleString('vi-VN')} tấn`;
  }
  return '—';
}

function tripStatusDriverUi(st: string): { label: string; bg: string; fg: string } {
  const s = st.toLowerCase();
  if (s.includes('progress') || s.includes('active') || s === 'in_progress') {
    return { label: 'Đang vận hành', bg: `${S.primary}18`, fg: S.primary };
  }
  if (s.includes('cancel')) {
    return { label: 'Đã hủy', bg: `${S.outlineVariant}44`, fg: S.onSurfaceVariant };
  }
  if (s.includes('complete')) {
    return { label: 'Hoàn thành', bg: `${S.primary}22`, fg: S.primary };
  }
  if (s.includes('plan')) {
    return { label: 'Đã lên lịch', bg: S.surfaceContainerHigh, fg: S.onSurfaceVariant };
  }
  return { label: st || '—', bg: S.surfaceContainerHigh, fg: S.onSurfaceVariant };
}

function ownerDriverDisplayName(d: OwnerDriverUser): string {
  const parts = [d.firstName, d.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return d.email;
}

export default function HarvestAreaDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : idParam?.[0];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [item, setItem] = useState<HarvestArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptHasNext, setReceiptHasNext] = useState(false);
  const [receiptApprovedAgg, setReceiptApprovedAgg] = useState<{
    count: number;
    totalVnd: number;
    loading: boolean;
  }>({ count: 0, totalVnd: 0, loading: true });
  const [assignedOwnerDrivers, setAssignedOwnerDrivers] = useState<OwnerDriverUser[]>([]);
  const [allManagedDrivers, setAllManagedDrivers] = useState<OwnerDriverUser[]>([]);
  const [assignedDriversLoading, setAssignedDriversLoading] = useState(false);
  const [addDriverModalOpen, setAddDriverModalOpen] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getHarvestArea(id);
      setItem(data);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được'));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadTrips = useCallback(async () => {
    if (!id) return;
    try {
      const res = await listTrips({ page: 1, limit: 25, harvestAreaId: id });
      const forArea = res.data.filter(
        (t) => String(t.harvestAreaId ?? '') === String(id),
      );
      setTrips(forArea.length ? forArea : res.data);
    } catch {
      setTrips([]);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (item) void loadTrips();
  }, [item, loadTrips]);

  const loadReceipts = useCallback(
    async (page: number) => {
      if (!id) return;
      setReceiptsLoading(true);
      try {
        const res = await listHarvestAreaReceipts(id, {
          page,
          limit: RECEIPTS_PAGE_SIZE,
        });
        if (!res.ok) {
          setReceipts([]);
          setReceiptHasNext(false);
          return;
        }
        setReceipts(res.body.data);
        setReceiptHasNext(res.body.hasNextPage);
        setReceiptPage(page);
      } catch {
        setReceipts([]);
        setReceiptHasNext(false);
      } finally {
        setReceiptsLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (item) void loadReceipts(1);
  }, [item, loadReceipts]);

  const loadReceiptAggregate = useCallback(async () => {
    if (!id) return;
    setReceiptApprovedAgg((prev) => ({ ...prev, loading: true }));
    try {
      const summary = await getHarvestAreaReceiptSummary(id);
      setReceiptApprovedAgg({
        count: summary.approvedCount,
        totalVnd: summary.approvedTotalAmount,
        loading: false,
      });
    } catch {
      setReceiptApprovedAgg({ count: 0, totalVnd: 0, loading: false });
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadReceiptAggregate();
    }, [loadReceiptAggregate]),
  );

  const loadAssignedOwnerDrivers = useCallback(async () => {
    if (!id || user?.role !== 'owner') return;
    setAssignedDriversLoading(true);
    try {
      const [assigned, allManaged] = await Promise.all([
        getHarvestAreaDrivers(id),
        listAllOwnerDrivers(),
      ]);
      setAssignedOwnerDrivers(assigned);
      setAllManagedDrivers(allManaged);
    } catch {
      setAssignedOwnerDrivers([]);
      setAllManagedDrivers([]);
    } finally {
      setAssignedDriversLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    if (item && user?.role === 'owner') void loadAssignedOwnerDrivers();
  }, [item, user?.role, loadAssignedOwnerDrivers]);

  const onDelete = useCallback(() => {
    if (!id) return;
    Alert.alert('Xóa khu thu hoạch', 'Khu sẽ được đánh dấu xóa (soft delete). Tiếp tục?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await deleteHarvestArea(id);
              router.back();
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không xóa được'));
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  }, [id, router]);

  const st = item ? normalizeHarvestStatus(item.status) : '';
  const pillColors = pillColorsForStatus(st);
  const driversFromTrips = useMemo(() => aggregateDriversFromTrips(trips).slice(0, 8), [trips]);
  const tripCountByDriverId = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of aggregateDriversFromTrips(trips)) {
      m.set(String(a.driverId), a.tripCount);
    }
    return m;
  }, [trips]);
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const unassignedManagedDrivers = useMemo(() => {
    const ids = new Set(assignedOwnerDrivers.map((d) => d.id));
    return allManagedDrivers.filter((d) => !ids.has(d.id));
  }, [allManagedDrivers, assignedOwnerDrivers]);

  const areaHa =
    item?.areaHectares != null ? `${Number(item.areaHectares).toLocaleString('vi-VN')} ha` : '—';
  const currentYield =
    item?.currentTons != null ? Number(item.currentTons) : null;
  const yieldText =
    currentYield != null
      ? `${currentYield.toLocaleString('vi-VN')} tấn`
      : item?.targetTons != null
        ? `${Number(item.targetTons).toLocaleString('vi-VN')} tấn (mục tiêu)`
        : '—';
  const yieldSubLabel =
    currentYield != null ? 'Hiện tại' : item?.targetTons != null ? 'Ước tính (mục tiêu)' : '';

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>Thiếu mã khu.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={S.primary} />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>{error ?? 'Không có dữ liệu'}</Text>
        <Pressable onPress={() => void load()} style={styles.retry}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const hasMapCoords = item.latitude != null && item.longitude != null;

  const openHarvestOnMap = () => {
    if (!hasMapCoords || !item) return;
    const la = Number(item.latitude);
    const lo = Number(item.longitude);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
    router.push({
      pathname: '/weighing-stations-map',
      params: { focusLat: String(la), focusLng: String(lo), focusId: String(id) },
    });
  };

  const onAddDriver = () => {
    if (isOwner) {
      if (assignedDriversLoading || !id) return;
      const goCreateDriver = () =>
        router.push({
          pathname: '/driver/form',
          params: {
            harvestAreaId: String(id),
            harvestAreaName: item?.name ? String(item.name) : '',
          },
        });
      if (allManagedDrivers.length === 0) {
        Alert.alert(
          'Thêm tài xế',
          'Chưa có tài xế managed. Tạo tài khoản mới — sau khi tạo, tài xế sẽ được gán vào khu này.',
          [
            { text: 'Huỷ', style: 'cancel' },
            { text: 'Tạo tài xế mới', onPress: goCreateDriver },
          ],
        );
        return;
      }
      Alert.alert(
        'Thêm tài xế',
        'Tạo tài khoản mới (POST /owner/drivers) hoặc gán tài xế đã có vào khu.',
        [
          { text: 'Huỷ', style: 'cancel' },
          { text: 'Tạo tài xế mới', onPress: goCreateDriver },
          { text: 'Gán tài xế có sẵn', onPress: () => setAddDriverModalOpen(true) },
        ],
      );
      return;
    }
    if (isAdmin) {
      router.push('/driver/form');
      return;
    }
    Alert.alert(
      'Thêm tài xế',
      'Chỉ chủ thầu (owner) mới gán tài xế vào bãi qua API. Admin có thể tạo tài khoản từ Quản trị.',
    );
  };

  const onPickDriverToAssign = (driver: OwnerDriverUser) => {
    if (!id) return;
    Alert.alert(
      'Gán tài xế vào khu',
      `Gán ${ownerDriverDisplayName(driver)} vào khu «${item?.name ?? ''}»?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Gán',
          onPress: () => {
            void (async () => {
              setAssigningDriverId(driver.id);
              try {
                await appendHarvestAreaForOwnerDriver(driver.id, id);
                setAddDriverModalOpen(false);
                await loadAssignedOwnerDrivers();
              } catch (e) {
                Alert.alert('Lỗi', getErrorMessage(e, 'Không gán được'));
              } finally {
                setAssigningDriverId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const onUnassignDriver = (driver: OwnerDriverUser) => {
    if (!id) return;
    Alert.alert(
      'Gỡ tài xế khỏi khu',
      `Bỏ quyền khai thác khu này đối với ${ownerDriverDisplayName(driver)}? (Các bãi khác của tài xế giữ nguyên.)`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Gỡ',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setAssigningDriverId(driver.id);
              try {
                await removeHarvestAreaFromOwnerDriver(driver.id, id);
                await loadAssignedOwnerDrivers();
              } catch (e) {
                Alert.alert('Lỗi', getErrorMessage(e, 'Không gỡ được'));
              } finally {
                setAssigningDriverId(null);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <View style={[headerStyles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={headerStyles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={headerStyles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Brand.ink} />
          </Pressable>
          <MaterialIcons name="eco" size={22} color={Brand.forest} />
          <Text style={headerStyles.headerTitle} numberOfLines={1}>
            Chi tiết khu khai thác
          </Text>
        </View>
      </View>
      <View style={headerStyles.headerHairline} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.heroCode} numberOfLines={1}>
              {' '}
              · {formatAreaRegionCode(item.id)}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsCell}>
            <Text style={styles.statsLabel}>Trạng thái</Text>
            <View style={[styles.statusPill, { backgroundColor: pillColors.bg }]}>
              <Text style={[styles.statusPillText, { color: pillColors.fg }]} numberOfLines={2}>
                {statusHeadlineVi(st).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.statsCell}>
            <Text style={styles.statsLabel}>Tổng diện tích</Text>
            <Text style={styles.statsValue}>{areaHa}</Text>
          </View>
          <View style={styles.statsCellFull}>
            <Text style={styles.statsLabel}>
              Sản lượng{yieldSubLabel ? ` (${yieldSubLabel})` : ''}
            </Text>
            <Text style={styles.statsValue} numberOfLines={2}>
              {yieldText}
            </Text>
            {currentYield == null && item.targetTons == null ? (
              <Text style={styles.statsHint}>Cập nhật khi đồng bộ sản lượng</Text>
            ) : null}
          </View>
          <View style={styles.statsSubRow}>
            <View style={styles.statsCell}>
              <Text style={styles.statsLabel}>Tổng doanh thu (đã duyệt)</Text>
              <Text style={styles.statsValue}>
                {receiptApprovedAgg.loading ? '…' : formatVndShortVi(receiptApprovedAgg.totalVnd)}
              </Text>
            </View>
            <View style={styles.statsCell}>
              <Text style={styles.statsLabel}>Phiếu đã duyệt</Text>
              <Text style={styles.statsValue}>
                {receiptApprovedAgg.loading ? '…' : String(receiptApprovedAgg.count)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Các phiếu cân của khu</Text>
            {isOwner ? (
              <Pressable
                onPress={() => router.push({ pathname: '/receipt/form', params: { harvestAreaId: String(id) } })}
                style={({ pressed }) => [styles.createReceiptBtn, pressed && styles.createReceiptBtnPressed]}>
                <Text style={styles.createReceiptBtnText}>Tạo phiếu</Text>
              </Pressable>
            ) : null}
          </View>
          {receiptsLoading ? (
            <ActivityIndicator color={S.primary} style={{ marginVertical: 12 }} />
          ) : receipts.length === 0 ? (
            <Text style={styles.emptyInline}>Chưa có phiếu cân nào cho khu này.</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={styles.receiptTable}>
                  <View style={styles.receiptTableHeader}>
                    <Text style={[styles.receiptTh, styles.receiptColDate]}>Ngày & giờ</Text>
                    <Text style={[styles.receiptTh, styles.receiptColWeight]}>KL (tấn)</Text>
                    <Text style={[styles.receiptTh, styles.receiptColStatus]}>Trạng thái</Text>
                    <Text style={[styles.receiptTh, styles.receiptColAmount]}>Số tiền</Text>
                  </View>
                  {receipts.map((r) => {
                    const { dateLine, timeLine } = formatReceiptDateAndTimeVi(r.receiptDate);
                    const stUi = receiptStatusUi(r.status);
                    return (
                      <Pressable
                        key={String(r.id)}
                        onPress={() => router.push(`/receipt/${String(r.id)}`)}
                        style={({ pressed }) => [styles.receiptTableRow, pressed && styles.receiptTableRowPressed]}>
                        <View style={styles.receiptColDateWrap}>
                          <Text style={styles.receiptTdDate}>{dateLine}</Text>
                          {timeLine ? <Text style={styles.receiptTdTime}>{timeLine}</Text> : null}
                        </View>
                        <Text style={[styles.receiptTd, styles.receiptColWeight]} numberOfLines={1}>
                          {receiptWeightLine(r)}
                        </Text>
                        <View style={[styles.receiptStatusPill, { backgroundColor: stUi.bg }]}>
                          <Text style={[styles.receiptStatusPillText, { color: stUi.fg }]} numberOfLines={1}>
                            {stUi.label}
                          </Text>
                        </View>
                        <Text style={[styles.receiptTd, styles.receiptColAmount]} numberOfLines={1}>
                          {formatReceiptAmountVnd(r)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={styles.receiptPager}>
                <Pressable
                  disabled={receiptPage <= 1 || receiptsLoading}
                  onPress={() => void loadReceipts(receiptPage - 1)}
                  style={({ pressed }) => [
                    styles.receiptPagerBtn,
                    (receiptPage <= 1 || receiptsLoading) && styles.receiptPagerBtnDisabled,
                    pressed && receiptPage > 1 && !receiptsLoading && styles.receiptPagerBtnPressed,
                  ]}>
                  <MaterialIcons name="chevron-left" size={22} color={receiptPage <= 1 ? S.outlineVariant : S.primary} />
                  <Text
                    style={[
                      styles.receiptPagerBtnText,
                      receiptPage <= 1 && styles.receiptPagerBtnTextDisabled,
                    ]}>
                    Trước
                  </Text>
                </Pressable>
                <Text style={styles.receiptPagerInfo}>
                  Trang {receiptPage}
                  {receiptHasNext || receiptPage > 1 ? ` · ${receipts.length} phiếu` : ''}
                </Text>
                <Pressable
                  disabled={!receiptHasNext || receiptsLoading}
                  onPress={() => void loadReceipts(receiptPage + 1)}
                  style={({ pressed }) => [
                    styles.receiptPagerBtn,
                    (!receiptHasNext || receiptsLoading) && styles.receiptPagerBtnDisabled,
                    pressed && receiptHasNext && !receiptsLoading && styles.receiptPagerBtnPressed,
                  ]}>
                  <Text
                    style={[
                      styles.receiptPagerBtnText,
                      !receiptHasNext && styles.receiptPagerBtnTextDisabled,
                    ]}>
                    Sau
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color={!receiptHasNext ? S.outlineVariant : S.primary}
                  />
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.mapCard}>
          <Text style={styles.mapEyebrow}>Vị trí khu</Text>
          <Pressable
            onPress={hasMapCoords ? openHarvestOnMap : undefined}
            disabled={!hasMapCoords}
            style={({ pressed }) => [
              styles.mapRow,
              !hasMapCoords && styles.mapRowDisabled,
              pressed && hasMapCoords && styles.mapRowPressed,
            ]}>
            <MaterialIcons name="map" size={22} color={hasMapCoords ? S.primary : S.outlineVariant} />
            <Text style={styles.mapRowText}>
              {hasMapCoords ? 'Mở vị trí trên bản đồ' : 'Chưa có vị trí — bổ sung trong form chỉnh sửa khu'}
            </Text>
            {hasMapCoords ? <MaterialIcons name="chevron-right" size={18} color={S.primary} /> : null}
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>
              Đội ngũ tài xế (
              {isOwner ? assignedOwnerDrivers.length : driversFromTrips.length})
            </Text>
            <Pressable
              onPress={onAddDriver}
              disabled={isOwner && assignedDriversLoading}
              style={({ pressed }) => [
                styles.addDriverBtn,
                pressed && styles.addDriverBtnPressed,
                isOwner && assignedDriversLoading && styles.disabled,
              ]}>
              <MaterialIcons name="person-add" size={18} color={S.primary} />
              <Text style={styles.addDriverText}>Thêm tài xế</Text>
            </Pressable>
          </View>
          {isOwner ? (
            <>
              {assignedDriversLoading ? (
                <ActivityIndicator color={S.primary} style={{ marginVertical: 12 }} />
              ) : assignedOwnerDrivers.length === 0 ? (
                <Text style={styles.emptyInline}>
                  Chưa gán tài xế cho khu này. Nhấn «Thêm tài xế» để chọn tài xế managed — cần gán bãi
                  trước khi tài xế tạo chuyến (PUT /owner/drivers/…/harvest-areas).
                </Text>
              ) : (
                assignedOwnerDrivers.map((d) => {
                  const tripsN = tripCountByDriverId.get(String(d.id));
                  const busy = assigningDriverId === d.id;
                  return (
                    <View key={d.id} style={styles.driverCard}>
                      <View style={styles.driverTop}>
                        <View style={styles.driverNameBlock}>
                          <Text style={styles.driverName}>{ownerDriverDisplayName(d)}</Text>
                          <Text style={styles.driverMeta} numberOfLines={1}>
                            {d.email}
                            {tripsN != null ? ` • ${tripsN} chuyến gần đây` : ''}
                          </Text>
                        </View>
                        <View style={styles.driverRowActions}>
                          <View style={[styles.assignedPill, { backgroundColor: `${S.primary}18` }]}>
                            <Text style={[styles.assignedPillText, { color: S.primary }]}>
                              Đã gán khu
                            </Text>
                          </View>
                          <Pressable
                            hitSlop={10}
                            disabled={busy}
                            onPress={() => onUnassignDriver(d)}
                            style={({ pressed }) => [
                              styles.unassignBtn,
                              pressed && styles.unassignBtnPressed,
                              busy && styles.disabled,
                            ]}>
                            {busy ? (
                              <ActivityIndicator size="small" color={S.onSurfaceVariant} />
                            ) : (
                              <MaterialIcons name="link-off" size={20} color={S.onSurfaceVariant} />
                            )}
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          ) : driversFromTrips.length === 0 ? (
            <Text style={styles.emptyInline}>
              Chưa có chuyến gắn khu này — danh sách tài xế sẽ hiện khi có dữ liệu trip.
            </Text>
          ) : (
            driversFromTrips.slice(0, 4).map((d) => {
              const ui = tripStatusDriverUi(d.lastStatus);
              return (
                <View key={d.key} style={styles.driverCard}>
                  <View style={styles.driverTop}>
                    <Text style={styles.driverName}>{d.displayName}</Text>
                    <View style={[styles.driverStatePill, { backgroundColor: ui.bg }]}>
                      <Text style={[styles.driverStateText, { color: ui.fg }]}>{ui.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.driverMeta} numberOfLines={1}>
                    {d.email ? `${d.email} • ` : ''}
                    {d.tripCount} chuyến gần đây
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <Modal
          visible={addDriverModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setAddDriverModalOpen(false)}>
          <View style={[styles.modalRoot, { paddingBottom: insets.bottom }]}>
            <Pressable style={styles.modalBackdropPress} onPress={() => setAddDriverModalOpen(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalGrab} />
              <Text style={styles.modalTitle}>Gán tài xế vào khu</Text>
              <Text style={styles.modalSubtitle}>
                Chọn tài xế managed chưa được gán khu này. API sẽ cập nhật danh sách bãi của tài xế.
              </Text>
              <ScrollView
                style={styles.modalList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                {unassignedManagedDrivers.length === 0 ? (
                  <Text style={styles.modalEmpty}>
                    Tất cả tài xế đã được gán khu này hoặc chưa có tài xế managed.
                  </Text>
                ) : (
                  unassignedManagedDrivers.map((d) => {
                    const busy = assigningDriverId === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        disabled={busy}
                        onPress={() => onPickDriverToAssign(d)}
                        style={({ pressed }) => [
                          styles.modalRow,
                          pressed && styles.modalRowPressed,
                          busy && styles.disabled,
                        ]}>
                        <View style={styles.modalRowText}>
                          <Text style={styles.modalRowTitle}>{ownerDriverDisplayName(d)}</Text>
                          <Text style={styles.modalRowSub} numberOfLines={1}>
                            {d.email}
                          </Text>
                        </View>
                        {busy ? (
                          <ActivityIndicator size="small" color={S.primary} />
                        ) : (
                          <MaterialIcons name="chevron-right" size={22} color={S.primary} />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <Pressable
                onPress={() => setAddDriverModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.modalCloseBtnPressed]}>
                <Text style={styles.modalCloseBtnText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrowSmall}>Liên hệ và bãi</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Liên hệ bãi</Text>
            <Text style={styles.infoValue}>{item.siteContactName ? String(item.siteContactName) : '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SĐT</Text>
            <Text style={styles.infoValue}>{item.siteContactPhone ? String(item.siteContactPhone) : '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{item.siteContactEmail ? String(item.siteContactEmail) : '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày mua/bắt đầu bãi</Text>
            <Text style={styles.infoValue}>{item.sitePurchaseDate ? String(item.sitePurchaseDate) : '—'}</Text>
          </View>
          {user?.role === 'admin' && item.ownerId != null ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Owner ID</Text>
              <Text style={styles.infoValue}>{String(item.ownerId)}</Text>
            </View>
          ) : null}
        </View>

        {item.siteNotes?.trim() ? (
          <View style={styles.noticeCard}>
            <View style={styles.noticeHead}>
              <MaterialIcons name="sticky-note-2" size={20} color={S.tertiary} />
              <Text style={styles.noticeTitle}>Ghi chú khu</Text>
            </View>
            <Text style={styles.noticeBody}>{String(item.siteNotes)}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.screenFooter,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}>
          <Pressable
            onPress={() => router.push({ pathname: '/harvest-area/form', params: { id: String(id) } })}
            style={({ pressed }) => [styles.footerBtn, styles.footerBtnPrimary, pressed && styles.footerBtnPressed]}>
            <MaterialIcons name="edit" size={20} color={S.primary} />
            <Text style={styles.footerBtnPrimaryText}>Chỉnh sửa khu</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            disabled={deleting}
            style={({ pressed }) => [
              styles.footerBtn,
              styles.footerBtnDanger,
              pressed && !deleting && styles.footerBtnDangerPressed,
              deleting && styles.disabled,
            ]}>
            <MaterialIcons name="delete-outline" size={20} color="#c62828" />
            <Text style={styles.footerBtnDangerText}>{deleting ? 'Đang xóa…' : 'Xóa khu'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.canvas,
  },
  err: {
    color: '#ba1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: S.primary,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  hero: {
    marginBottom: 16,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    gap: 4,
  },
  heroTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Brand.ink,
  },
  heroCode: {
    fontSize: 15,
    fontWeight: '600',
    color: S.onSurfaceVariant,
    flexShrink: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statsCell: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}88`,
  },
  statsCellFull: {
    width: '100%',
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}88`,
  },
  statsSubRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    letterSpacing: -0.2,
  },
  statsHint: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    color: `${S.outline}b3`,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabled: { opacity: 0.55 },
  mapCard: { marginBottom: 16 },
  mapEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 10,
  },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: S.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}66`,
  },
  mapRowDisabled: {
    opacity: 0.85,
  },
  mapRowPressed: {
    backgroundColor: `${S.primary}14`,
  },
  mapRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  createReceiptBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: S.primary,
  },
  createReceiptBtnPressed: {
    opacity: 0.92,
  },
  createReceiptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  receiptTable: {
    minWidth: '100%',
  },
  receiptTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: S.outlineVariant,
    paddingBottom: 8,
    marginBottom: 4,
  },
  receiptTh: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
  },
  receiptColDate: { width: 118, paddingRight: 8 },
  receiptColWeight: { width: 80, paddingRight: 8 },
  receiptColStatus: { width: 108, paddingRight: 8 },
  receiptColAmount: { width: 96, paddingRight: 4, textAlign: 'right' },
  receiptColDateWrap: {
    width: 118,
    paddingRight: 8,
    justifyContent: 'center',
  },
  receiptTdDate: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
  },
  receiptTdTime: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    color: S.onSurfaceVariant,
  },
  receiptStatusPill: {
    width: 108,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  receiptStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  receiptTableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${S.outlineVariant}99`,
  },
  receiptTableRowPressed: {
    backgroundColor: `${S.primary}0f`,
  },
  receiptTd: {
    fontSize: 13,
    color: Brand.ink,
  },
  receiptPager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${S.outlineVariant}55`,
  },
  receiptPagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  receiptPagerBtnPressed: {
    backgroundColor: `${S.primary}12`,
  },
  receiptPagerBtnDisabled: {
    opacity: 0.45,
  },
  receiptPagerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  receiptPagerBtnTextDisabled: {
    color: S.outlineVariant,
  },
  receiptPagerInfo: {
    fontSize: 13,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  screenFooter: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 24,
    paddingTop: 20,
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${S.outlineVariant}aa`,
    backgroundColor: 'transparent',
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 44,
  },
  footerBtnPrimary: {
    borderWidth: 1.5,
    borderColor: S.primary,
    backgroundColor: Brand.surface,
  },
  footerBtnDanger: {
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
    backgroundColor: '#fff5f5',
  },
  footerBtnPressed: {
    backgroundColor: `${S.primary}12`,
  },
  footerBtnDangerPressed: {
    backgroundColor: '#ffebee',
  },
  footerBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: S.primary,
  },
  footerBtnDangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c62828',
  },
  sectionCard: {
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}66`,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    flex: 1,
  },
  addDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: `${S.primary}12`,
  },
  addDriverBtnPressed: {
    opacity: 0.88,
  },
  addDriverText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  emptyInline: {
    fontSize: 14,
    lineHeight: 21,
    color: S.onSurfaceVariant,
  },
  driverCard: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
  },
  driverTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
    flex: 1,
  },
  driverStatePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  driverStateText: {
    fontSize: 11,
    fontWeight: '700',
  },
  driverMeta: {
    fontSize: 13,
    color: S.onSurfaceVariant,
  },
  driverNameBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  driverRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  assignedPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unassignBtn: {
    padding: 8,
    borderRadius: 10,
  },
  unassignBtnPressed: {
    backgroundColor: `${S.outlineVariant}44`,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    maxHeight: '78%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}66`,
  },
  modalGrab: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: S.outlineVariant,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: S.onSurfaceVariant,
    marginBottom: 14,
  },
  modalList: {
    maxHeight: 340,
    marginHorizontal: -4,
  },
  modalEmpty: {
    fontSize: 14,
    lineHeight: 21,
    color: S.onSurfaceVariant,
    paddingVertical: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalRowPressed: {
    backgroundColor: `${S.primary}0f`,
  },
  modalRowText: {
    flex: 1,
    minWidth: 0,
  },
  modalRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
  },
  modalRowSub: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    marginTop: 2,
  },
  modalCloseBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: S.surfaceContainerHigh,
  },
  modalCloseBtnPressed: {
    opacity: 0.9,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  sectionEyebrowSmall: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 14,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: S.onSurfaceVariant,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
  },
  noticeCard: {
    backgroundColor: S.tertiaryFixed,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${S.tertiary}33`,
  },
  noticeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: S.onTertiaryFixed,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 21,
    color: S.onTertiaryFixed,
  },
});
