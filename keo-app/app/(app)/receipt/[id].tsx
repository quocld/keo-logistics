import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';

import { ReceiptImageLightbox } from '@/components/receipt/ReceiptImageLightbox';
import { ReceiptRemoteImage } from '@/components/receipt/ReceiptRemoteImage';
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

import { Brand } from '@/constants/brand';
import { pickDefaultAvatar } from '@/constants/images';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { approveReceipt, getReceipt, rejectReceipt } from '@/lib/api/receipts';
import { prefetchReceiptImages } from '@/lib/images/receipt-image-cache';
import { collectReceiptImageSources } from '@/lib/receipt/receipt-image-urls';
import type { Receipt } from '@/lib/types/ops';

/** Khớp token từ Stitch export (Chi tiết Phiếu cân - Redesign) */
const C = {
  bg: '#fbf9f8',
  surfaceLow: '#f5f3f3',
  surfaceLowest: '#ffffff',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#3e4a3f',
  primary: '#006a35',
  primaryContainer: '#128646',
  onPrimaryContainer: '#f6fff4',
  outlineVariant: '#becabc',
  secondaryContainer: '#93f7bc',
  primaryFixed: '#91f8ac',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
};

const S = Brand.stitch;

function normalizeReceiptStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

function statusLabelVi(st: string): string {
  if (st === 'pending') return 'Chờ duyệt';
  if (st === 'approved') return 'Đã duyệt';
  if (st === 'rejected') return 'Từ chối';
  return st || '—';
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

function driverPhotoUrl(r: Receipt): string | null {
  const d = r.driver as { photo?: string | null } | null | undefined;
  if (d && d.photo && String(d.photo).trim()) return String(d.photo);
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

function weighingUnitPriceVndPerTon(r: Receipt): number | null {
  const w = (r as { weighingStation?: { unitPrice?: string | number | null } | null }).weighingStation;
  const raw = w && typeof w === 'object' ? w.unitPrice : null;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatVndInt(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')} VND`;
}

function formatVndPerTon(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')} VND/Tấn`;
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

function cardShadow() {
  return {
    shadowColor: '#1b1c1c',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 4,
  };
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
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

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
  const imageSources = useMemo(() => (receipt ? collectReceiptImageSources(receipt) : []), [receipt]);
  const images = useMemo(() => imageSources.map((s) => s.uri), [imageSources]);
  const heroSource = imageSources[0];
  const heroUri = heroSource?.uri ?? null;
  const extraSources = imageSources.slice(1);
  const driverSeed = receipt
    ? Number(
        (receipt as { driverId?: unknown }).driverId ??
          ((receipt as { driver?: { id?: unknown } | null }).driver?.id ?? 0),
      ) || 0
    : 0;

  useEffect(() => {
    if (images.length === 0) return;
    void prefetchReceiptImages(images);
  }, [images]);
  const tripId = (receipt as { tripId?: string | number | null })?.tripId;
  const rejectedReason = (receipt as { rejectedReason?: string | null })?.rejectedReason;
  const notes =
    receipt?.notes != null && String(receipt.notes).trim() ? String(receipt.notes).trim() : null;

  const unitPriceStation = receipt ? weighingUnitPriceVndPerTon(receipt) : null;
  const unitPriceDerived =
    weight != null && weight > 0 && amount != null ? amount / weight : null;
  const unitPriceDisplay = unitPriceStation ?? unitPriceDerived;

  const grossWeight = (receipt as { grossWeight?: number | string | null })?.grossWeight;
  const tareWeight = (receipt as { tareWeight?: number | string | null })?.tareWeight;
  const grossNum =
    grossWeight != null && Number.isFinite(Number(grossWeight)) ? Number(grossWeight) : null;
  const tareNum = tareWeight != null && Number.isFinite(Number(tareWeight)) ? Number(tareWeight) : null;

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
        <ActivityIndicator size="large" color={C.primary} />
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

  const footerH = canModerate && pending ? 100 + insets.bottom : 0;
  const bottomPad = 32 + footerH;

  const openPreviewAt = (index: number) => {
    if (images.length > 0) setLightbox({ urls: images, index });
  };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* TopAppBar — Stitch */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.topBarLeft}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            accessibilityLabel="Quay lại">
            <MaterialIcons name="arrow-back" size={24} color={C.primary} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            Chi tiết Phiếu cân
          </Text>
        </View>
        <View style={styles.topSpacer} />
      </View>
      <View style={styles.hairline} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}>
        {/* Hero ảnh 3:4 + glass “Chạm để phóng to” */}
        <View style={styles.heroSection}>
          <Pressable
            onPress={() => openPreviewAt(0)}
            disabled={!heroUri}
            style={({ pressed }) => [styles.heroFrame, pressed && heroUri && { opacity: 0.96 }]}>
            {heroUri && heroSource ? (
              <ReceiptRemoteImage
                uri={heroSource.uri}
                cacheKey={heroSource.cacheKey}
                containerStyle={styles.heroImgContainer}
                style={styles.heroImg}
                contentFit="cover"
                indicatorColor={C.primary}
              />
            ) : (
              <View style={styles.heroPlaceholder}>
                <LinearGradient
                  colors={['#e8f5e9', C.surfaceLow, '#c8e6c9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <MaterialIcons name="receipt-long" size={52} color={C.primary} />
                <Text style={styles.heroPhText}>Chưa có ảnh phiếu</Text>
              </View>
            )}
            {heroUri ? (
              <View style={styles.glassPill}>
                <MaterialIcons name="zoom-in" size={16} color={C.onSurfaceVariant} />
                <Text style={styles.glassPillText}>Chạm để phóng to</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.column}>
          {/* Driver Profile Card */}
          <View style={[styles.cardWhite, cardShadow()]}>
            <View style={styles.driverRow}>
              <View style={styles.avatarWrap}>
                {driverPhotoUrl(receipt) ? (
                  <Image
                    source={{ uri: driverPhotoUrl(receipt)! }}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Image source={pickDefaultAvatar(driverSeed)} style={styles.avatarImg} contentFit="cover" />
                )}
                <View style={styles.avatarOnlineDot} />
              </View>
              <View style={styles.driverText}>
                <Text style={styles.driverName}>{driverName(receipt)}</Text>
                <Text style={styles.driverIdLine}>ID: {displayId}</Text>
                <Text style={styles.driverStatus}>Trạng thái: {statusLabelVi(st)}</Text>
              </View>
            </View>
          </View>

          {/* Thông tin vận hành */}
          <View style={[styles.cardWhite, cardShadow()]}>
            <Text style={styles.sectionEyebrow}>Thông tin vận hành</Text>
            <View style={styles.fieldGap}>
              <View>
                <Text style={styles.fieldLabel}>Khu vực thu hoạch</Text>
                <Pressable
                  onPress={receipt.harvestAreaId != null && user?.role === 'owner' ? openHarvestArea : undefined}
                  disabled={!(receipt.harvestAreaId != null && user?.role === 'owner')}>
                  <Text style={styles.fieldValue}>{harvestAreaLine(receipt)}</Text>
                  {receipt.harvestAreaId != null && user?.role === 'owner' ? (
                    <Text style={styles.linkHint}>Mở chi tiết khu →</Text>
                  ) : null}
                </Pressable>
              </View>
              <View>
                <Text style={styles.fieldLabel}>Trạm cân</Text>
                <Text style={styles.fieldValue}>{weighingStationLine(receipt)}</Text>
              </View>
              <View>
                <Text style={styles.fieldLabel}>Thời gian thực hiện</Text>
                <Text style={styles.fieldValue}>{formatReceiptDate(receipt.receiptDate)}</Text>
              </View>
              {tripId != null && tripId !== '' ? (
                <View>
                  <Text style={styles.fieldLabel}>Chuyến</Text>
                  <Text style={styles.fieldValue}>#{String(tripId)}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Thông số kỹ thuật — nền surface-container-low */}
          <View style={[styles.cardMuted, cardShadow()]}>
            <Text style={styles.sectionEyebrow}>Thông số kỹ thuật</Text>
            <View style={styles.grid2}>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Tổng trọng lượng</Text>
                <Text style={styles.techMd}>
                  {grossNum != null ? (
                    <>
                      {String(grossNum)} <Text style={styles.techUnit}>tấn</Text>
                    </>
                  ) : (
                    '—'
                  )}
                </Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.fieldLabel}>Trọng lượng xe</Text>
                <Text style={styles.techMd}>
                  {tareNum != null ? (
                    <>
                      {String(tareNum)} <Text style={styles.techUnit}>tấn</Text>
                    </>
                  ) : (
                    '—'
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.netRow}>
              <Text style={styles.fieldLabel}>Trọng lượng tịnh</Text>
              <Text style={styles.netBig}>
                {weight != null ? (
                  <>
                    {weight.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}{' '}
                    <Text style={styles.netUnit}>tấn</Text>
                  </>
                ) : (
                  '—'
                )}
              </Text>
            </View>
          </View>

          {/* Giá trị thanh toán — primary-container */}
          <View style={styles.payCard}>
            <Text style={styles.payEyebrow}>Giá trị thanh toán</Text>
            <View style={styles.payStack}>
              <View style={styles.payBlock}>
                <Text style={styles.paySubLabel}>Đơn giá</Text>
                <Text
                  style={styles.payMd}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}>
                  {unitPriceDisplay != null ? formatVndPerTon(unitPriceDisplay) : '—'}
                </Text>
              </View>
              <View style={styles.payDivider} />
              <View style={styles.payBlock}>
                <Text style={styles.paySubLabel}>Tổng cộng</Text>
                <Text
                  style={styles.payTotal}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}>
                  {amount != null ? formatVndInt(amount) : '—'}
                </Text>
              </View>
            </View>
          </View>

          {st === 'rejected' && rejectedReason ? (
            <View style={styles.rejectBox}>
              <MaterialIcons name="error-outline" size={22} color={C.error} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectEyebrow}>Lý do từ chối</Text>
                <Text style={styles.rejectTxt}>{String(rejectedReason)}</Text>
              </View>
            </View>
          ) : null}

          {notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.sectionEyebrow}>Ghi chú</Text>
              <Text style={styles.notesBody}>{notes}</Text>
            </View>
          ) : null}

          {extraSources.length > 0 ? (
            <View>
              <Text style={styles.sectionEyebrow}>Ảnh khác</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                {extraSources.map((src, thumbIdx) => (
                  <Pressable
                    key={src.cacheKey ?? src.uri}
                    onPress={() => openPreviewAt(1 + thumbIdx)}
                    style={styles.thumb}>
                    <ReceiptRemoteImage
                      uri={src.uri}
                      cacheKey={src.cacheKey}
                      containerStyle={styles.thumbInner}
                      style={styles.thumbImg}
                      contentFit="cover"
                      indicatorColor={C.primary}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Fixed footer — Stitch */}
      {canModerate && pending ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            onPress={onReject}
            disabled={busy}
            style={({ pressed }) => [styles.btnReject, pressed && styles.btnRejectPressed, busy && styles.disabled]}>
            <MaterialIcons name="close" size={22} color={C.error} />
            <Text style={styles.btnRejectTxt}>TỪ CHỐI</Text>
          </Pressable>
          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={({ pressed }) => [styles.btnApproveWrap, pressed && { opacity: 0.94 }, busy && styles.disabled]}>
            <LinearGradient
              colors={['#006a35', '#128646']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnApproveGrad}>
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={22} color="#fff" />
                  <Text style={styles.btnApproveTxt}>PHÊ DUYỆT PHIẾU CÂN</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      <ReceiptImageLightbox
        visible={lightbox != null && lightbox.urls.length > 0}
        urls={lightbox?.urls ?? []}
        initialIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: C.bg,
  },
  err: { color: C.error, textAlign: 'center', marginBottom: 12 },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.primary,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.55 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: C.bg,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  iconBtn: { padding: 8, marginLeft: -8, borderRadius: 999 },
  iconBtnPressed: { backgroundColor: C.surfaceLow },
  topTitle: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: C.onSurface,
    flex: 1,
  },
  topSpacer: { width: 40 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: C.surfaceLow, width: '100%' },

  scroll: { flex: 1 },
  scrollContent: {},

  heroSection: {
    backgroundColor: C.surfaceLow,
    padding: 16,
  },
  heroFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.surfaceLowest,
    ...cardShadow(),
  },
  heroImgContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#e8ebe8',
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhText: { marginTop: 10, fontSize: 14, fontWeight: '600', color: C.onSurfaceVariant },
  glassPill: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${C.outlineVariant}33`,
  },
  glassPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.onSurfaceVariant,
  },

  column: { padding: 24, gap: 24 },

  cardWhite: {
    backgroundColor: C.surfaceLowest,
    borderRadius: 12,
    padding: 24,
  },
  cardMuted: {
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    padding: 24,
  },

  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.onSurfaceVariant,
    marginBottom: 16,
  },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.primaryFixed },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: C.primaryFixed,
    backgroundColor: C.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 20, fontWeight: '800', color: C.primary },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.secondaryContainer,
    borderWidth: 2,
    borderColor: C.surfaceLowest,
  },
  driverText: { flex: 1, minWidth: 0 },
  driverName: { fontSize: 18, fontWeight: '600', color: C.onSurface, lineHeight: 24 },
  driverIdLine: { fontSize: 14, fontWeight: '500', letterSpacing: 0.3, color: C.onSurfaceVariant, marginTop: 2 },
  driverStatus: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 6 },

  fieldGap: { gap: 16 },
  fieldLabel: { fontSize: 12, color: C.onSurfaceVariant, marginBottom: 4 },
  fieldValue: { fontSize: 16, fontWeight: '500', color: C.onSurface },
  linkHint: { fontSize: 13, fontWeight: '700', color: C.primary, marginTop: 6 },

  grid2: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  gridCell: { flex: 1 },
  techMd: { fontSize: 20, fontWeight: '600', color: C.onSurface },
  techUnit: { fontSize: 14, fontWeight: '400', color: C.onSurface },
  netRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${C.outlineVariant}33`,
  },
  netBig: { fontSize: 30, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
  netUnit: { fontSize: 18, fontWeight: '500', color: C.primary },

  payCard: {
    backgroundColor: C.primaryContainer,
    borderRadius: 12,
    padding: 24,
  },
  payEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    opacity: 0.85,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.onPrimaryContainer,
    marginBottom: 16,
  },
  paySubLabel: { fontSize: 12, opacity: 0.85, color: C.onPrimaryContainer, marginBottom: 4 },
  payMd: {
    fontSize: 18,
    fontWeight: '600',
    color: C.onPrimaryContainer,
    lineHeight: 24,
    maxWidth: '100%',
  },
  payTotal: {
    fontSize: 24,
    fontWeight: '800',
    color: C.onPrimaryContainer,
    lineHeight: 30,
    maxWidth: '100%',
  },
  payStack: { width: '100%' },
  payBlock: { width: '100%', alignSelf: 'stretch' },
  payDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginVertical: 14,
  },

  rejectBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: C.errorContainer,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  rejectEyebrow: { fontSize: 11, fontWeight: '800', color: '#93000a', marginBottom: 4 },
  rejectTxt: { fontSize: 15, color: '#5d1a1a', lineHeight: 22 },

  notesBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: S.tertiaryFixed,
    borderWidth: 1,
    borderColor: `${S.tertiary}28`,
  },
  notesBody: { fontSize: 15, lineHeight: 22, color: S.onTertiaryFixed, marginTop: 8 },

  thumbRow: { gap: 10, marginTop: 8 },
  thumb: { width: 88, height: 88, borderRadius: 10, overflow: 'hidden' },
  thumbInner: { width: '100%', height: '100%', backgroundColor: '#e8ebe8' },
  thumbImg: { width: '100%', height: '100%' },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: C.surfaceLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${C.outlineVariant}1a`,
    shadowColor: '#1b1c1c',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 8,
  },
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.error,
    backgroundColor: C.surfaceLowest,
  },
  btnRejectPressed: { backgroundColor: `${C.errorContainer}33` },
  btnRejectTxt: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5, color: C.error },
  btnApproveWrap: { flex: 2, borderRadius: 8, overflow: 'hidden' },
  btnApproveGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnApproveTxt: { fontSize: 14, fontWeight: '800', letterSpacing: 0.4, color: '#fff' },

});
