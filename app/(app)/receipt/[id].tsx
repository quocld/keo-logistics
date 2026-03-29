import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { approveReceipt, getReceipt, rejectReceipt } from '@/lib/api/receipts';
import { collectReceiptImageUrls } from '@/lib/receipt/receipt-image-urls';
import type { Receipt, TripDriverRef } from '@/lib/types/ops';

const S = Brand.stitch;

const HERO_H = 248;

function normalizeReceiptStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

function statusPillLabel(st: string): string {
  if (st === 'pending') return 'Chờ duyệt';
  if (st === 'approved') return 'Đã duyệt';
  if (st === 'rejected') return 'Từ chối';
  return st ? st : '—';
}

function formatReceiptKtCode(id: string | number): string {
  const n = String(id).replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `KT-${n}`;
}

function driverName(r: Receipt): string {
  const d = r.driver;
  if (d && typeof d === 'object') {
    const parts = [d.firstName, d.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    if (d.email) return d.email;
  }
  if (r.driverId != null && r.driverId !== '') return `Tài xế #${r.driverId}`;
  return '—';
}

function driverEmail(r: Receipt): string | null {
  const d = r.driver as TripDriverRef | null | undefined;
  if (d && typeof d === 'object' && d.email) return String(d.email);
  return null;
}

function harvestAreaLine(r: Receipt): string {
  const n = r.harvestArea && typeof r.harvestArea === 'object' ? r.harvestArea.name : null;
  if (n) return String(n);
  if (r.harvestAreaId != null && r.harvestAreaId !== '') return `Khu #${r.harvestAreaId}`;
  return '—';
}

function weighingStationLine(r: Receipt): string {
  const w = (r as { weighingStation?: { name?: string } | null }).weighingStation;
  if (w && typeof w === 'object' && w.name) return String(w.name);
  const id = (r as { weighingStationId?: unknown }).weighingStationId;
  if (id != null && id !== '') return `Trạm #${id}`;
  return '—';
}

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function formatReceiptDate(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
}

function statusChipStyle(st: string): { bg: string; border: string; text: string } {
  switch (st) {
    case 'pending':
      return { bg: 'rgba(255,193,7,0.95)', border: 'rgba(255,179,0,0.4)', text: '#3e2723' };
    case 'approved':
      return { bg: 'rgba(26,138,74,0.95)', border: 'rgba(255,255,255,0.35)', text: '#fff' };
    case 'rejected':
      return { bg: 'rgba(198,40,40,0.95)', border: 'rgba(255,255,255,0.25)', text: '#fff' };
    default:
      return { bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.2)', text: '#fff' };
  }
}

function DetailRow({
  icon,
  label,
  value,
  sub,
  onPress,
  actionLabel,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  sub?: string | null;
  onPress?: () => void;
  actionLabel?: string;
}) {
  const inner = (
    <>
      <View style={styles.rowIconWrap}>
        <MaterialIcons name={icon} size={22} color={S.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        {onPress && actionLabel ? (
          <View style={styles.rowActionHint}>
            <Text style={styles.rowActionText}>{actionLabel}</Text>
            <MaterialIcons name="chevron-right" size={18} color={S.primary} />
          </View>
        ) : null}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
        accessibilityRole="button">
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.listRow}>{inner}</View>;
}

export default function ReceiptDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : idParam?.[0];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canModerate = user?.role === 'owner' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getReceipt(id);
      setReceipt(data);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được phiếu'));
      setReceipt(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const st = receipt ? normalizeReceiptStatus(receipt.status) : '';
  const pending = st === 'pending';
  const weight =
    receipt?.weight != null && Number.isFinite(Number(receipt.weight)) ? Number(receipt.weight) : null;
  const amount =
    receipt?.amount != null && Number.isFinite(Number(receipt.amount)) ? Number(receipt.amount) : null;
  const displayId = receipt?.billCode?.trim()
    ? receipt.billCode.trim()
    : receipt
      ? formatReceiptKtCode(receipt.id)
      : '—';
  const images = useMemo(() => (receipt ? collectReceiptImageUrls(receipt) : []), [receipt]);
  const heroUri = images[0] ?? null;
  const extraImages = images.slice(1);
  const tripId = (receipt as { tripId?: string | number | null })?.tripId;
  const rejectedReason = (receipt as { rejectedReason?: string | null })?.rejectedReason;
  const notes =
    receipt?.notes != null && String(receipt.notes).trim() ? String(receipt.notes).trim() : null;
  const chip = statusChipStyle(st);

  const onApprove = () => {
    if (!receipt || !id) return;
    Alert.alert('Phê duyệt phiếu', 'Xác nhận phê duyệt phiếu cân này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Phê duyệt',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const next = await approveReceipt(id);
              setReceipt(next);
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không phê duyệt được'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const onReject = () => {
    if (!receipt || !id) return;
    Alert.alert('Từ chối phiếu', 'Bạn có chắc muốn từ chối phiếu này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const next = await rejectReceipt(id, { rejectedReason: 'Từ chối từ app' });
              setReceipt(next);
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không từ chối được'));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const openHarvestArea = () => {
    if (!receipt?.harvestAreaId) return;
    router.push(`/harvest-area/${String(receipt.harvestAreaId)}`);
  };

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>Thiếu mã phiếu.</Text>
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

  if (error || !receipt) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>{error ?? 'Không có dữ liệu'}</Text>
        <Pressable onPress={() => void load()} style={styles.retry}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const bottomPad = insets.bottom + (canModerate && pending ? 108 : 20);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <LinearGradient
                colors={['#e8f5e9', S.surfaceContainerLow, '#c8e6c9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <MaterialIcons name="receipt-long" size={56} color={S.primary} style={{ opacity: 0.85 }} />
              <Text style={styles.heroPlaceholderHint}>Chưa có ảnh phiếu</Text>
            </View>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.65)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroTop, { paddingTop: Math.max(insets.top, 10) }]}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={({ pressed }) => [styles.heroCircleBtn, pressed && styles.heroCircleBtnPressed]}
              accessibilityLabel="Quay lại">
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() =>
                Alert.alert('Phiếu cân', 'GET /receipts/:id · POST …/approve · …/reject (KeoTram Ops).')
              }
              hitSlop={8}
              style={({ pressed }) => [styles.heroCircleBtn, pressed && styles.heroCircleBtnPressed]}>
              <MaterialIcons name="help-outline" size={22} color="#fff" />
            </Pressable>
          </View>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: chip.bg, borderColor: chip.border },
            ]}>
            <Text style={[styles.statusChipText, { color: chip.text }]}>{statusPillLabel(st)}</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroEyebrow}>Phiếu cân</Text>
            <Text style={styles.heroTitle}>{displayId}</Text>
            <Text style={styles.heroDate}>{formatReceiptDate(receipt.receiptDate)}</Text>
          </View>
        </View>

        <View style={[styles.sheet, { marginTop: -28 }]}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Trọng lượng</Text>
                <Text style={styles.summaryNum}>{weight != null ? `${weight}` : '—'}</Text>
                <Text style={styles.summaryUnit}>tấn</Text>
              </View>
              <View style={styles.summaryDividerV} />
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Thành tiền</Text>
                <Text style={styles.summaryMoney} numberOfLines={2}>
                  {amount != null ? formatVnd(amount) : '—'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.blockTitle}>Thông tin chi tiết</Text>
          <View style={styles.listCard}>
            <DetailRow icon="person" label="Tài xế" value={driverName(receipt)} sub={driverEmail(receipt)} />
            <View style={styles.listHairline} />
            <DetailRow
              icon="eco"
              label="Khu khai thác"
              value={harvestAreaLine(receipt)}
              onPress={receipt.harvestAreaId != null && user?.role === 'owner' ? openHarvestArea : undefined}
              actionLabel={receipt.harvestAreaId != null && user?.role === 'owner' ? 'Xem khu' : undefined}
            />
            <View style={styles.listHairline} />
            <DetailRow icon="scale" label="Trạm cân" value={weighingStationLine(receipt)} />
            {tripId != null && tripId !== '' ? (
              <>
                <View style={styles.listHairline} />
                <DetailRow icon="local-shipping" label="Chuyến" value={`#${String(tripId)}`} />
              </>
            ) : null}
          </View>

          {st === 'rejected' && rejectedReason ? (
            <View style={styles.rejectCard}>
              <MaterialIcons name="block" size={22} color="#c62828" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectCardTitle}>Lý do từ chối</Text>
                <Text style={styles.rejectCardBody}>{String(rejectedReason)}</Text>
              </View>
            </View>
          ) : null}

          {notes ? (
            <View style={styles.notesCard}>
              <View style={styles.notesHead}>
                <MaterialIcons name="sticky-note-2" size={20} color={S.tertiary} />
                <Text style={styles.notesTitle}>Ghi chú</Text>
              </View>
              <Text style={styles.notesBody}>{notes}</Text>
            </View>
          ) : null}

          {extraImages.length > 0 ? (
            <>
              <Text style={styles.blockTitle}>Ảnh khác ({extraImages.length})</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}>
                {extraImages.map((uri) => (
                  <Pressable key={uri} onPress={() => setPreviewUrl(uri)} style={styles.thumb}>
                    <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                    <View style={styles.thumbZoom}>
                      <MaterialIcons name="zoom-in" size={16} color="#fff" />
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      {canModerate && pending ? (
        <View style={[styles.footerDock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.footerInner}>
            <Pressable
              onPress={onReject}
              disabled={busy}
              style={({ pressed }) => [styles.btnOutline, pressed && styles.btnOutlinePressed, busy && styles.disabled]}>
              <Text style={styles.btnOutlineText}>Từ chối</Text>
            </Pressable>
            <Pressable
              onPress={onApprove}
              disabled={busy}
              style={({ pressed }) => [styles.btnFill, pressed && styles.btnFillPressed, busy && styles.disabled]}>
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnFillText}>Phê duyệt</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal visible={previewUrl != null} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPreviewUrl(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalBar}>
              <Text style={styles.modalTitle}>Ảnh phiếu</Text>
              <Pressable onPress={() => setPreviewUrl(null)} hitSlop={12}>
                <MaterialIcons name="close" size={26} color={Brand.ink} />
              </Pressable>
            </View>
            {previewUrl ? (
              <Image source={{ uri: previewUrl }} style={styles.modalImage} contentFit="contain" />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.canvas },
  scroll: { flex: 1 },
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
  disabled: { opacity: 0.55 },

  heroWrap: {
    height: HERO_H,
    width: '100%',
    backgroundColor: '#1a1c1a',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderHint: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  heroTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  heroCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroCircleBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  statusChip: {
    position: 'absolute',
    top: HERO_H * 0.38,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#fff',
    marginBottom: 4,
  },
  heroDate: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.88)',
  },

  sheet: {
    paddingHorizontal: 16,
  },
  summaryCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 8,
    marginBottom: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}99`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  summaryDividerV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: S.outlineVariant,
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 6,
  },
  summaryNum: {
    fontSize: 32,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -1,
  },
  summaryUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: S.onSurfaceVariant,
    marginTop: 2,
  },
  summaryMoney: {
    fontSize: 17,
    fontWeight: '800',
    color: Brand.ink,
    textAlign: 'center',
    lineHeight: 22,
  },

  blockTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 10,
    marginLeft: 4,
  },
  listCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}88`,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  listRowPressed: {
    backgroundColor: `${S.primary}08`,
  },
  listHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: S.outlineVariant,
    marginLeft: 56,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${S.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: S.onSurfaceVariant,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
    lineHeight: 22,
  },
  rowSub: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    marginTop: 4,
  },
  rowActionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 2,
  },
  rowActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: S.primary,
  },

  rejectCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff8f8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  rejectCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b71c1c',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rejectCardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4e1616',
  },

  notesCard: {
    backgroundColor: S.tertiaryFixed,
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: `${S.tertiary}28`,
  },
  notesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: S.onTertiaryFixed,
  },
  notesBody: {
    fontSize: 15,
    lineHeight: 22,
    color: S.onTertiaryFixed,
  },

  thumbRow: {
    gap: 10,
    paddingBottom: 8,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: S.surfaceContainerLow,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbZoom: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    padding: 4,
  },

  footerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Brand.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.outlineVariant,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  footerInner: {
    flexDirection: 'row',
    gap: 12,
  },
  btnOutline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e8a0a8',
    backgroundColor: Brand.surface,
  },
  btnOutlinePressed: {
    backgroundColor: '#fff5f5',
  },
  btnOutlineText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#c62828',
  },
  btnFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: S.primary,
    shadowColor: S.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  btnFillPressed: {
    opacity: 0.94,
  },
  btnFillText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Brand.ink,
  },
  modalImage: {
    width: '100%',
    height: 360,
    backgroundColor: '#000',
  },
});
