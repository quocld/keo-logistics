import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stitchHarvestFormStyles as headerStyles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { deleteWeighingStation, getWeighingStation } from '@/lib/api/weighing-stations';
import type { WeighingStation } from '@/lib/types/ops';

const S = Brand.stitch;

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

function formatVndPerTon(n: number): string {
  return `${Number(n).toLocaleString('vi-VN')} VNĐ/Tấn`;
}

function pickStr(item: WeighingStation, keys: string[]): string | null {
  for (const k of keys) {
    const v = item[k];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return null;
}

export default function WeighingStationDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : idParam?.[0];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<WeighingStation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getWeighingStation(id);
      setItem(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
              Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xóa được');
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

  const partnerName = item ? pickStr(item, ['contactName', 'siteContactName', 'representativeName']) : null;
  const partnerPhone = item ? pickStr(item, ['contactPhone', 'siteContactPhone', 'phone']) : null;
  const calibration = item ? pickStr(item, ['calibrationValidUntil', 'calibrationExpiry', 'inspectionValidUntil']) : null;

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
    item.unitPrice != null ? formatVndPerTon(Number(item.unitPrice)) : 'Chưa cấu hình';
  const monthlyText =
    monthlyCount != null ? `${monthlyCount.toLocaleString('vi-VN')} lượt` : '—';
  const revenueText =
    revenueHint != null
      ? `${(revenueHint / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}M VNĐ`
      : '—';

  return (
    <View style={styles.flex}>
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
        <View style={headerStyles.headerRight}>
          <Pressable style={headerStyles.headerIconBtn} hitSlop={8}>
            <MaterialIcons name="notifications-none" size={22} color={Brand.ink} />
          </Pressable>
          <View style={headerStyles.headerDivider} />
          <Pressable
            style={headerStyles.helpBtn}
            hitSlop={8}
            onPress={() =>
              Alert.alert('Hỗ trợ', 'GET/PATCH/DELETE /weighing-stations/:id — KeoTram Ops Postman.')
            }>
            <MaterialIcons name="help-outline" size={20} color={Brand.ink} />
            <Text style={headerStyles.helpBtnText}>Hỗ trợ</Text>
          </Pressable>
        </View>
      </View>
      <View style={headerStyles.headerHairline} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}>
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
        </View>

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
            <Text style={styles.metricEyebrow}>Tổng lượt cân (Tháng)</Text>
            <Text style={styles.metricValue}>{monthlyText}</Text>
            {monthlyCount == null ? (
              <Text style={styles.metricHint}>Thống kê khi đồng bộ phiếu cân</Text>
            ) : null}
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Doanh thu dự kiến</Text>
            <Text style={styles.metricValue}>{revenueText}</Text>
            {revenueHint == null ? (
              <Text style={styles.metricHint}>Ước tính theo đơn giá và khối lượng</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Lịch sử cân gần đây</Text>
            <Pressable hitSlop={8} onPress={() => Alert.alert('Phiếu cân', 'Danh sách phiếu sẽ mở từ API receipts/trips.')}>
              <Text style={styles.linkText}>Xem tất cả</Text>
            </Pressable>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.thPlate]}>Biển số xe</Text>
            <Text style={[styles.th, styles.thMid]}>Khối lượng</Text>
            <Text style={[styles.th, styles.thMid]}>Loại hàng</Text>
            <Text style={[styles.th, styles.thMoney]}>Thành tiền</Text>
          </View>
          <View style={styles.tableEmpty}>
            <MaterialIcons name="receipt-long" size={36} color={`${S.outline}66`} />
            <Text style={styles.tableEmptyText}>Chưa có phiếu cân gần đây trên thiết bị.</Text>
          </View>
        </View>

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

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrowSmall}>Thông tin đối tác</Text>
          <View style={styles.partnerRow}>
            <MaterialIcons name="account-circle" size={22} color={S.outline} />
            <View style={styles.partnerBody}>
              <Text style={styles.partnerLabel}>Đại diện</Text>
              <Text style={styles.partnerValue}>{partnerName ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.partnerRow}>
            <MaterialIcons name="phone" size={22} color={S.outline} />
            <View style={styles.partnerBody}>
              <Text style={styles.partnerLabel}>Điện thoại</Text>
              <Text style={styles.partnerValue}>{partnerPhone ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.partnerRow}>
            <MaterialIcons name="verified-user" size={22} color={S.outline} />
            <View style={styles.partnerBody}>
              <Text style={styles.partnerLabel}>Kiểm định</Text>
              <Text style={styles.partnerValue}>
                {calibration ? `Còn hạn đến ${calibration}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() =>
            Alert.alert(
              'Tạo lệnh cân mới',
              'Tính năng sẽ gắn với vòng đời chuyến (trip) và phiếu cân trên KeoTram Ops.',
            )
          }
          style={styles.ctaWrap}>
          <LinearGradient
            colors={[S.primary, S.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}>
            <Text style={styles.ctaText}>Tạo lệnh cân mới</Text>
          </LinearGradient>
        </Pressable>

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
              Kiểm tra định kỳ thiết bị cảm biến và hiệu chuẩn theo quy định. Thêm ghi chú tại trạm để nhắc nhở đội
              kỹ thuật.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  idMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: S.onSurfaceVariant,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Brand.ink,
    marginBottom: 12,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 18,
  },
  addrIcon: {
    marginTop: 1,
  },
  addrText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: S.onSurfaceVariant,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  btnOutlinePressed: {
    backgroundColor: `${S.primary}12`,
  },
  btnOutlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
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
  btnOutlineDangerPressed: {
    backgroundColor: '#ffebee',
  },
  btnOutlineDangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c62828',
  },
  disabled: {
    opacity: 0.55,
  },
  metricsScroll: {
    gap: 12,
    paddingBottom: 4,
    marginBottom: 20,
  },
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
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
    letterSpacing: -0.2,
  },
  metricHint: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    color: `${S.outline}b3`,
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
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.ink,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
    paddingBottom: 8,
    marginBottom: 12,
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
  },
  thPlate: { flex: 1.1 },
  thMid: { flex: 1 },
  thMoney: { flex: 1, textAlign: 'right' },
  tableEmpty: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  tableEmptyText: {
    fontSize: 14,
    color: S.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  mapCard: {
    marginBottom: 18,
  },
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
  mapCoord: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
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
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  partnerBody: {
    flex: 1,
  },
  partnerLabel: {
    fontSize: 12,
    color: S.onSurfaceVariant,
    marginBottom: 2,
  },
  partnerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
  },
  ctaWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: S.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  noticeCard: {
    backgroundColor: S.tertiaryFixed,
    borderRadius: 12,
    padding: 16,
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
    opacity: 0.95,
  },
});
