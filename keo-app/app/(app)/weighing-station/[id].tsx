import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stitchHarvestFormStyles as headerStyles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import {
  deleteWeighingStation,
  getWeighingStation,
  listWeighingStationReceipts,
} from '@/lib/api/weighing-stations';
import { formatReceiptDateAndTimeVi } from '@/lib/date/vi-receipt-time';
import { formatVndShortVi } from '@/lib/format/vnd-vi';
import type { Receipt, TripDriverRef, WeighingStation } from '@/lib/types/ops';

const S = Brand.stitch;

const RECEIPTS_PAGE_SIZE = 10;

function normalizeStationStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

function statusLabelVi(st: string): string {
  if (st.includes('active') || st === '1') return 'Hoạt động';
  if (st.includes('inactive') || st.includes('disabled') || st.includes('ngưng')) return 'Ngưng';
  if (!st) return '—';
  return st.replace(/_/g, ' ');
}

function formatStationCode(id: string | number): string {
  const n = String(id).replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `#TCN-${n}`;
}

function driverDisplayName(d: TripDriverRef | null | undefined): string {
  if (!d) return '—';
  const parts = [d.firstName, d.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return d.email ?? '—';
}

function receiptStatusUi(raw: unknown): { label: string; bg: string; fg: string } {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s.includes('approved')) return { label: 'Đã duyệt', bg: `${S.primary}22`, fg: S.primary };
  if (s.includes('pending')) return { label: 'Chờ duyệt', bg: `${Brand.ink}0f`, fg: Brand.inkMuted };
  if (s.includes('reject')) return { label: 'Từ chối', bg: '#ffebee', fg: '#b71c1c' };
  return { label: s || '—', bg: S.surfaceContainerHigh, fg: S.onSurfaceVariant };
}

function receiptWeightLine(r: Receipt): string {
  const w = r.weight;
  if (w != null && Number.isFinite(Number(w))) return `${Number(w).toLocaleString('vi-VN')} tấn`;
  return '—';
}

function receiptAmountStr(r: Receipt): string {
  const a = r.amount;
  if (a == null || !Number.isFinite(Number(a))) return '—';
  return formatVndShortVi(Number(a));
}

export default function WeighingStationDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : idParam?.[0];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isDriver = user?.role === 'driver';
  const isOwner = user?.role === 'owner';

  const [item, setItem] = useState<WeighingStation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptHasNext, setReceiptHasNext] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getWeighingStation(id);
      setItem(data);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được'));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadReceipts = useCallback(
    async (page: number) => {
      if (!id) return;
      setReceiptsLoading(true);
      try {
        const res = await listWeighingStationReceipts(id, { page, limit: RECEIPTS_PAGE_SIZE });
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
    void load();
  }, [load]);

  useEffect(() => {
    if (item) void loadReceipts(1);
  }, [item, loadReceipts]);

  // Reload receipts khi quay về từ màn receipt detail
  useFocusEffect(
    useCallback(() => {
      if (item && id) void loadReceipts(receiptPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, item]),
  );

  const onDelete = useCallback(() => {
    if (!id) return;
    Alert.alert('Xóa trạm cân', 'Trạm sẽ được đánh dấu xóa (soft delete). Tiếp tục?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await deleteWeighingStation(id);
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

  const displayId = useMemo(() => {
    if (!item) return '—';
    return item.code?.trim() ? item.code.trim() : formatStationCode(item.id);
  }, [item]);

  const stRaw = item ? normalizeStationStatus(item.status) : '';
  const statusLabel = statusLabelVi(stRaw);

  const monthlyCount = item
    ? (typeof item.monthlyWeighCount === 'number' ? item.monthlyWeighCount : null)
    : null;
  const revenueHint = item
    ? (typeof item.expectedMonthlyRevenue === 'number' ? item.expectedMonthlyRevenue : null)
    : null;

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>Thiếu mã trạm.</Text>
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

  const priceText =
    item.unitPrice != null
      ? `${Number(item.unitPrice).toLocaleString('vi-VN')} VNĐ/Tấn`
      : 'Chưa cấu hình';
  const monthlyText =
    monthlyCount != null ? `${monthlyCount.toLocaleString('vi-VN')} lượt` : '—';
  const revenueText =
    revenueHint != null ? formatVndShortVi(revenueHint) : '—';

  return (
    <View style={styles.flex}>
      {/* ── Header ── */}
      <View style={[headerStyles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={headerStyles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={headerStyles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Brand.ink} />
          </Pressable>
          <MaterialIcons name="scale" size={22} color={Brand.forest} />
          <Text style={headerStyles.headerTitle} numberOfLines={1}>
            Chi tiết trạm cân
          </Text>
        </View>
      </View>
      <View style={headerStyles.headerHairline} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={[styles.statusPill, { backgroundColor: S.secondaryContainer }]}>
              <Text style={[styles.statusPillText, { color: S.onSecondaryContainer }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
            <Text style={styles.idMuted}>ID: {displayId}</Text>
          </View>
          <Text style={styles.heroTitle}>{item.name}</Text>
          <View style={styles.addrRow}>
            <MaterialIcons name="location-on" size={20} color={S.primary} style={styles.addrIcon} />
            <Text style={styles.addrText}>
              {item.formattedAddress?.trim() ? item.formattedAddress : 'Chưa có địa chỉ'}
            </Text>
          </View>
          {!isDriver ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/weighing-station/form', params: { id: String(id) } })
                }
                style={({ pressed }) => [styles.btnOutline, pressed && styles.btnOutlinePressed]}>
                <MaterialIcons name="edit" size={18} color={S.primary} />
                <Text style={styles.btnOutlineText}>Chỉnh sửa</Text>
              </Pressable>
              <Pressable
                onPress={onDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.btnOutlineDanger,
                  pressed && styles.btnOutlineDangerPressed,
                  deleting && styles.disabled,
                ]}>
                <MaterialIcons name="delete-outline" size={18} color="#c62828" />
                <Text style={styles.btnOutlineDangerText}>{deleting ? 'Đang xóa…' : 'Xóa trạm'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* ── Metrics ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsScroll}>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Đơn giá hiện tại</Text>
            <Text style={styles.metricValue} numberOfLines={2}>
              {priceText}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Lượt cân (tháng)</Text>
            <Text style={styles.metricValue}>{monthlyText}</Text>
            {monthlyCount == null ? (
              <Text style={styles.metricHint}>Đồng bộ từ phiếu cân</Text>
            ) : null}
          </View>
          {!isDriver ? (
            <View style={styles.metricCard}>
              <Text style={styles.metricEyebrow}>Doanh thu dự kiến</Text>
              <Text style={styles.metricValue}>{revenueText}</Text>
              {revenueHint == null ? (
                <Text style={styles.metricHint}>Ước tính theo đơn giá & KL</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* ── CTA Tạo phiếu cân (owner only) ── */}
        {isOwner ? (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/receipt/form',
                params: { weighingStationId: String(id) },
              })
            }
            activeOpacity={0.88}
            style={styles.ctaWrap}>
            <LinearGradient
              colors={[S.primary, S.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}>
              <MaterialIcons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.ctaText}>Tạo phiếu cân tại trạm này</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {/* ── Lịch sử cân ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Lịch sử cân gần đây</Text>
            {isOwner ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/receipt/form',
                    params: { weighingStationId: String(id) },
                  })
                }
                style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed]}>
                <Text style={styles.createBtnText}>Tạo phiếu</Text>
              </Pressable>
            ) : null}
          </View>

          {receiptsLoading ? (
            <ActivityIndicator color={S.primary} style={{ marginVertical: 12 }} />
          ) : receipts.length === 0 ? (
            <View style={styles.tableEmpty}>
              <MaterialIcons name="receipt-long" size={36} color={`${S.outline}66`} />
              <Text style={styles.tableEmptyText}>Chưa có phiếu cân nào tại trạm này.</Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  {/* Table header */}
                  <View style={styles.receiptTableHeader}>
                    <Text style={[styles.receiptTh, styles.colDate]}>Ngày & giờ</Text>
                    <Text style={[styles.receiptTh, styles.colDriver]}>Tài xế</Text>
                    <Text style={[styles.receiptTh, styles.colWeight]}>KL (tấn)</Text>
                    <Text style={[styles.receiptTh, styles.colStatus]}>Trạng thái</Text>
                    <Text style={[styles.receiptTh, styles.colAmount]}>Số tiền</Text>
                  </View>
                  {/* Rows */}
                  {receipts.map((r) => {
                    const { dateLine, timeLine } = formatReceiptDateAndTimeVi(r.receiptDate);
                    const stUi = receiptStatusUi(r.status);
                    return (
                      <Pressable
                        key={String(r.id)}
                        onPress={() => router.push(`/receipt/${String(r.id)}`)}
                        style={({ pressed }) => [
                          styles.receiptTableRow,
                          pressed && styles.receiptTableRowPressed,
                        ]}>
                        <View style={[styles.colDate, styles.colDateWrap]}>
                          <Text style={styles.receiptTdDate}>{dateLine}</Text>
                          {timeLine ? (
                            <Text style={styles.receiptTdTime}>{timeLine}</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.receiptTd, styles.colDriver]} numberOfLines={2}>
                          {driverDisplayName(r.driver)}
                        </Text>
                        <Text style={[styles.receiptTd, styles.colWeight]} numberOfLines={1}>
                          {receiptWeightLine(r)}
                        </Text>
                        <View style={[styles.colStatus, styles.colStatusWrap]}>
                          <View style={[styles.statusBadge, { backgroundColor: stUi.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: stUi.fg }]} numberOfLines={1}>
                              {stUi.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.receiptTd, styles.colAmount]} numberOfLines={1}>
                          {receiptAmountStr(r)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Pagination */}
              <View style={styles.pager}>
                <Pressable
                  disabled={receiptPage <= 1 || receiptsLoading}
                  onPress={() => void loadReceipts(receiptPage - 1)}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    (receiptPage <= 1 || receiptsLoading) && styles.pagerBtnDisabled,
                    pressed && receiptPage > 1 && styles.pagerBtnPressed,
                  ]}>
                  <MaterialIcons
                    name="chevron-left"
                    size={20}
                    color={receiptPage <= 1 ? S.outlineVariant : S.primary}
                  />
                  <Text style={[styles.pagerBtnText, receiptPage <= 1 && styles.pagerBtnTextDisabled]}>
                    Trước
                  </Text>
                </Pressable>
                <Text style={styles.pagerInfo}>
                  Trang {receiptPage}
                  {receiptHasNext || receiptPage > 1 ? ` · ${receipts.length} phiếu` : ''}
                </Text>
                <Pressable
                  disabled={!receiptHasNext || receiptsLoading}
                  onPress={() => void loadReceipts(receiptPage + 1)}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    (!receiptHasNext || receiptsLoading) && styles.pagerBtnDisabled,
                    pressed && receiptHasNext && styles.pagerBtnPressed,
                  ]}>
                  <Text
                    style={[styles.pagerBtnText, !receiptHasNext && styles.pagerBtnTextDisabled]}>
                    Sau
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={!receiptHasNext ? S.outlineVariant : S.primary}
                  />
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* ── Vị trí bản đồ ── */}
        <View style={styles.mapCard}>
          <Text style={styles.mapEyebrow}>Vị trí trạm cân</Text>
          <View style={styles.mapVisual}>
            <LinearGradient
              colors={['#e8f5e9', S.surfaceContainerLow, '#c8e6c9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <MaterialIcons name="place" size={48} color={S.primary} style={{ opacity: 0.85 }} />
            <Text style={styles.mapCoord}>
              {item.latitude != null && item.longitude != null
                ? `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}`
                : 'Chưa có tọa độ GPS'}
            </Text>
          </View>
        </View>

        {/* ── Ghi chú / Bảo trì ── */}
        {item.notes?.trim() ? (
          <View style={styles.noticeCard}>
            <View style={styles.noticeHead}>
              <MaterialIcons name="info-outline" size={20} color={S.tertiary} />
              <Text style={styles.noticeTitle}>Lưu ý bảo trì / ghi chú</Text>
            </View>
            <Text style={styles.noticeBody}>{String(item.notes)}</Text>
          </View>
        ) : (
          <View style={styles.noticeCard}>
            <View style={styles.noticeHead}>
              <MaterialIcons name="info-outline" size={20} color={S.tertiary} />
              <Text style={styles.noticeTitle}>Lưu ý bảo trì</Text>
            </View>
            <Text style={styles.noticeBody}>
              Kiểm tra định kỳ thiết bị cảm biến và hiệu chuẩn theo quy định. Thêm ghi chú tại
              trạm để nhắc nhở đội kỹ thuật.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.canvas,
  },
  err: { color: '#ba1a1a', textAlign: 'center', marginBottom: 12 },
  retry: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: S.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600' },

  // Hero
  hero: { marginBottom: 20 },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  idMuted: { fontSize: 13, fontWeight: '500', color: S.onSurfaceVariant },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Brand.ink,
    marginBottom: 12,
  },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 18 },
  addrIcon: { marginTop: 1 },
  addrText: { flex: 1, fontSize: 15, lineHeight: 22, color: S.onSurfaceVariant },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: S.primary,
    backgroundColor: Brand.surface,
  },
  btnOutlinePressed: { backgroundColor: `${S.primary}12` },
  btnOutlineText: { fontSize: 14, fontWeight: '600', color: S.primary },
  btnOutlineDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
    backgroundColor: '#fff5f5',
  },
  btnOutlineDangerPressed: { backgroundColor: '#ffebee' },
  btnOutlineDangerText: { fontSize: 14, fontWeight: '600', color: '#c62828' },
  disabled: { opacity: 0.55 },

  // Metrics
  metricsScroll: { gap: 12, paddingBottom: 4, marginBottom: 20 },
  metricCard: {
    width: 200,
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 16,
    marginRight: 4,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}88`,
  },
  metricEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  metricValue: { fontSize: 17, fontWeight: '700', color: Brand.ink, letterSpacing: -0.2 },
  metricHint: { marginTop: 6, fontSize: 11, lineHeight: 15, color: `${S.outline}b3` },

  // CTA
  ctaWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: S.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  // Section
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
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Brand.ink },
  createBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: `${S.primary}18`,
  },
  createBtnPressed: { backgroundColor: `${S.primary}28` },
  createBtnText: { fontSize: 13, fontWeight: '700', color: S.primary },

  // Receipt table
  receiptTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
    paddingBottom: 8,
    marginBottom: 2,
  },
  receiptTh: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
  },
  receiptTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${S.outlineVariant}55`,
  },
  receiptTableRowPressed: { backgroundColor: `${S.primary}08` },
  receiptTd: { fontSize: 13, color: Brand.ink },
  receiptTdDate: { fontSize: 13, fontWeight: '600', color: Brand.ink },
  receiptTdTime: { fontSize: 11, color: S.onSurfaceVariant, marginTop: 2 },

  // Fixed column widths
  colDate: { width: 110 },
  colDateWrap: { justifyContent: 'center' },
  colDriver: { width: 120, paddingRight: 8 },
  colWeight: { width: 90, textAlign: 'right' },
  colStatus: { width: 100, paddingHorizontal: 8 },
  colStatusWrap: { justifyContent: 'center', alignItems: 'flex-start' },
  colAmount: { width: 100, textAlign: 'right' },

  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  tableEmpty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  tableEmptyText: { fontSize: 14, color: S.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 12 },

  // Pagination
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${S.outlineVariant}66`,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: `${S.primary}12`,
  },
  pagerBtnDisabled: { backgroundColor: 'transparent' },
  pagerBtnPressed: { backgroundColor: `${S.primary}20` },
  pagerBtnText: { fontSize: 13, fontWeight: '600', color: S.primary },
  pagerBtnTextDisabled: { color: S.outlineVariant },
  pagerInfo: { fontSize: 13, color: S.onSurfaceVariant, fontWeight: '500' },

  // Map
  mapCard: { marginBottom: 18 },
  mapEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 10,
  },
  mapVisual: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.surfaceContainerLow,
  },
  mapCoord: { marginTop: 8, fontSize: 12, fontWeight: '500', color: S.onSurfaceVariant },

  // Notice
  noticeCard: {
    backgroundColor: S.tertiaryFixed,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: `${S.tertiary}33`,
  },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: S.onTertiaryFixed },
  noticeBody: { fontSize: 14, lineHeight: 21, color: S.onTertiaryFixed, opacity: 0.95 },
});
