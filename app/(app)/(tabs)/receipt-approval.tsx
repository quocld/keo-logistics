import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ReceiptImageLightbox } from '@/components/receipt/ReceiptImageLightbox';
import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';
import { pickDefaultAvatar } from '@/constants/images';
import { getErrorMessage } from '@/lib/api/errors';
import { approveReceipt, listReceipts, rejectReceipt } from '@/lib/api/receipts';
import { formatVndShortVi } from '@/lib/format/vnd-vi';
import { collectReceiptImageUrls, firstReceiptImageUrl } from '@/lib/receipt/receipt-image-urls';
import type { Receipt } from '@/lib/types/ops';

/** Icon phiếu (Stitch / asset) */
const PHIEU_ICON = require('@/assets/images/phieu-icon.png');

const S = Brand.stitch;
const PAGE_SIZE = 10;

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
];

function normalizeReceiptStatus(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    return String((raw as { name: string }).name).toLowerCase().trim();
  }
  return String(raw).toLowerCase().trim();
}

function statusPillLabel(st: string): string {
  if (st === 'pending') return 'CHỜ DUYỆT';
  if (st === 'approved') return 'ĐÃ DUYỆT';
  if (st === 'rejected') return 'TỪ CHỐI';
  return st ? st.toUpperCase() : '—';
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
  return 'Tài xế (chưa rõ)';
}

function harvestAreaLine(r: Receipt): string {
  const n = r.harvestArea && typeof r.harvestArea === 'object' ? r.harvestArea.name : null;
  if (n) return String(n);
  if (r.harvestAreaId != null && r.harvestAreaId !== '') return `Khu #${r.harvestAreaId}`;
  return '—';
}

/** Ngày giờ phiếu — khớp cách hiển thị màn chi tiết */
function formatReceiptDateTime(r: Receipt): string {
  const raw = r.receiptDate ?? (r as { createdAt?: string | null }).createdAt;
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

function driverPhotoUrl(r: Receipt): string | null {
  const d = r.driver as { photo?: string | null } | null | undefined;
  if (d && d.photo && String(d.photo).trim()) return String(d.photo);
  return null;
}

function driverSeed(r: Receipt): number {
  return (
    Number(
      (r as { driverId?: unknown }).driverId ?? ((r as { driver?: { id?: unknown } | null }).driver?.id ?? 0),
    ) || 0
  );
}

function parseReceiptTabParam(
  raw: string | string[] | undefined,
): 'all' | 'pending' | 'approved' | 'rejected' | null {
  const t = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (t === 'all' || t === 'approved' || t === 'pending' || t === 'rejected') return t;
  return null;
}

function calendarDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyFromReceipt(r: Receipt): string {
  const raw = r.receiptDate ?? (r as { createdAt?: string | null }).createdAt;
  if (raw && typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return calendarDayKey(d);
  }
  return '__nodate__';
}

function receiptSortTime(r: Receipt): number {
  const raw = r.receiptDate ?? (r as { createdAt?: string | null }).createdAt;
  if (raw && typeof raw === 'string') {
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function relativeSectionTitle(dayKeyStr: string): string {
  if (dayKeyStr === '__nodate__') return 'Không rõ ngày';
  const today = calendarDayKey(new Date());
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterday = calendarDayKey(yest);
  if (dayKeyStr === today) return 'Hôm nay';
  if (dayKeyStr === yesterday) return 'Hôm qua';
  const [Y, M, D] = dayKeyStr.split('-').map(Number);
  const dt = new Date(Y, M - 1, D);
  const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return `${weekdays[dt.getDay()]}, ${String(D).padStart(2, '0')}/${String(M).padStart(2, '0')}/${Y}`;
}

type ReceiptSection = { title: string; data: Receipt[] };

function buildReceiptSections(items: Receipt[]): ReceiptSection[] {
  const buckets = new Map<string, Receipt[]>();
  for (const r of items) {
    const k = dayKeyFromReceipt(r);
    const arr = buckets.get(k) ?? [];
    arr.push(r);
    buckets.set(k, arr);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => receiptSortTime(b) - receiptSortTime(a));
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === '__nodate__') return 1;
    if (b === '__nodate__') return -1;
    return b.localeCompare(a);
  });
  return keys.map((k) => ({
    title: relativeSectionTitle(k),
    data: buckets.get(k)!,
  }));
}

/** Viền trên phiếu — màu tươi, dễ phân biệt trạng thái */
function statusTopBorderColor(st: string): string {
  if (st === 'pending') return '#00bcd4';
  if (st === 'approved') return '#00c853';
  if (st === 'rejected') return '#ff5252';
  return `${S.outlineVariant}`;
}

/** Viền đáy kiểu mép xé phiếu (SVG, kéo giãn theo chiều ngang) */
function slipZigzagPath(w: number, h: number, teeth: number): string {
  const tw = w / teeth;
  const mid = Math.max(2, h - 6);
  let d = `M0,0 L${w},0 L${w},${mid} `;
  for (let i = teeth; i > 0; i--) {
    const xR = i * tw;
    const xM = xR - tw / 2;
    d += `L${xM},${h} L${xR - tw},${mid} `;
  }
  d += `L0,${mid} L0,0 Z`;
  return d;
}

function ReceiptSlipZigzag({ fill }: { fill: string }) {
  const w = 320;
  const h = 11;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Path d={slipZigzagPath(w, h, 18)} fill={fill} />
    </Svg>
  );
}

function ReceiptCard({
  item,
  busy,
  onApprove,
  onReject,
  onPreview,
  onOpenDetail,
}: {
  item: Receipt;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPreview: () => void;
  onOpenDetail: () => void;
}) {
  const st = normalizeReceiptStatus(item.status);
  const pending = st === 'pending';
  const weight = item.weight != null && Number.isFinite(Number(item.weight)) ? Number(item.weight) : null;
  const amount = item.amount != null && Number.isFinite(Number(item.amount)) ? Number(item.amount) : null;
  const displayId = item.billCode?.trim() ? item.billCode.trim() : formatReceiptKtCode(item.id);
  const hasImage = Boolean(firstReceiptImageUrl(item));
  const photo = driverPhotoUrl(item);
  const seed = driverSeed(item);
  const topBarColor = statusTopBorderColor(st);
  const weightStr =
    weight != null ? `${weight.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} tấn` : '—';
  const moneyStr = amount != null && Number.isFinite(amount) ? formatVndShortVi(amount) : '—';
  const dateTimeLine = formatReceiptDateTime(item);

  return (
    <View style={cardStyles.slipOuter}>
      <View
        style={[
          cardStyles.slipBody,
          {
            borderTopColor: topBarColor,
          },
        ]}>
        <View style={cardStyles.cardTitleRow}>
          <Pressable
            onPress={onOpenDetail}
            style={({ pressed }) => [cardStyles.cardTopPress, pressed && cardStyles.cardMainPressPressed]}
            accessibilityRole="button"
            accessibilityLabel="Xem chi tiết phiếu">
            <View style={cardStyles.cardTopInner}>
              <View style={cardStyles.avatarWrap}>
                {photo ? (
                  <Image source={{ uri: photo }} style={cardStyles.avatarImg} contentFit="cover" />
                ) : (
                  <Image source={pickDefaultAvatar(seed)} style={cardStyles.avatarImg} contentFit="cover" />
                )}
              </View>
              <View style={cardStyles.cardTitleBlock}>
                <Text style={cardStyles.driverName} numberOfLines={1}>
                  {driverName(item)}
                </Text>
                <View style={cardStyles.metaRow}>
                  <Text style={cardStyles.idLine} numberOfLines={1}>
                    {displayId}
                  </Text>
                  <Text style={cardStyles.metaSep}>·</Text>
                  <View
                    style={[
                      cardStyles.pill,
                      pending
                        ? cardStyles.pillPendingGray
                        : st === 'approved'
                          ? cardStyles.pillOk
                          : st === 'rejected'
                            ? cardStyles.pillReject
                            : cardStyles.pillMuted,
                    ]}>
                    <Text
                      style={[
                        cardStyles.pillText,
                        pending
                          ? cardStyles.pillTextGray
                          : st === 'approved'
                            ? cardStyles.pillTextOk
                            : st === 'rejected'
                              ? cardStyles.pillTextReject
                              : cardStyles.pillTextMuted,
                      ]}>
                      {statusPillLabel(st)}
                    </Text>
                  </View>
                </View>
                <Text style={cardStyles.dateLine} numberOfLines={1}>
                  {dateTimeLine}
                </Text>
              </View>
            </View>
          </Pressable>
          {hasImage ? (
            <Pressable
              onPress={onPreview}
              style={({ pressed }) => [cardStyles.zoomBtn, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Xem ảnh phiếu">
              <MaterialIcons name="zoom-in" size={20} color={S.primary} />
            </Pressable>
          ) : (
            <View style={cardStyles.zoomBtnMuted}>
              <MaterialIcons name="image-not-supported" size={18} color={`${S.outline}88`} />
            </View>
          )}
        </View>

        <Pressable
          onPress={onOpenDetail}
          style={({ pressed }) => [cardStyles.cardMainPress, pressed && cardStyles.cardMainPressPressed]}
          accessibilityRole="button"
          accessibilityLabel="Xem chi tiết phiếu">
          <View style={cardStyles.heroRow}>
            <Text style={cardStyles.heroWeight}>{weightStr}</Text>
            <Text style={cardStyles.heroMoney}>{moneyStr}</Text>
          </View>

          <View style={cardStyles.footerRow}>
            <Text style={cardStyles.areaMuted} numberOfLines={1}>
              {harvestAreaLine(item)}
            </Text>
            <MaterialIcons name="chevron-right" size={18} color={S.onSurfaceVariant} />
          </View>
        </Pressable>

        {pending ? (
          <View style={cardStyles.actions}>
            <Pressable
              onPress={onReject}
              disabled={busy}
              style={({ pressed }) => [
                cardStyles.rejectBtn,
                pressed && cardStyles.rejectBtnPressed,
                busy && cardStyles.btnDisabled,
              ]}>
              <Text style={cardStyles.rejectBtnText}>Từ chối</Text>
            </Pressable>
            <Pressable
              onPress={onApprove}
              disabled={busy}
              style={({ pressed }) => [
                cardStyles.approveBtnWrap,
                pressed && cardStyles.approveBtnPressed,
                busy && cardStyles.btnDisabled,
              ]}>
              <LinearGradient
                colors={[S.primary, S.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={cardStyles.approveBtnGrad}>
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={cardStyles.approveBtnText}>Phê duyệt</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Text style={cardStyles.doneHint} numberOfLines={1}>
            Đã xử lý
          </Text>
        )}
      </View>
      <ReceiptSlipZigzag fill={Brand.surface} />
    </View>
  );
}

export default function ReceiptApprovalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [items, setItems] = useState<Receipt[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const p = parseReceiptTabParam(tabParam);
    if (tabParam != null && String(tabParam).length > 0 && p != null) {
      setStatusTab(p);
    }
  }, [tabParam]);
  const [imageLightbox, setImageLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const res = await listReceipts({
        page: nextPage,
        limit: PAGE_SIZE,
        status: statusTab === 'all' ? undefined : statusTab,
      });
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
    },
    [statusTab],
  );

  const initialLoad = useCallback(async () => {
    setError(null);
    setForbidden(false);
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
      setError(getErrorMessage(e, 'Không tải được'));
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const onLoadMore = useCallback(async () => {
    if (forbidden || !hasNext || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [forbidden, hasNext, loadPage, loadingMore, loading, page]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const name = driverName(r).toLowerCase();
      const area = harvestAreaLine(r).toLowerCase();
      const idStr = String(r.id);
      const bill = (r.billCode ?? '').toLowerCase();
      return name.includes(q) || area.includes(q) || idStr.includes(q) || bill.includes(q);
    });
  }, [items, searchQuery]);

  const receiptSections = useMemo(() => buildReceiptSections(filtered), [filtered]);

  const runApprove = useCallback(
    (r: Receipt) => {
      const id = String(r.id);
      Alert.alert('Phê duyệt phiếu', 'Xác nhận phê duyệt phiếu cân này? Doanh thu sẽ ghi theo đơn giá trạm.', [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Phê duyệt',
          onPress: () => {
            void (async () => {
              setBusyId(id);
              try {
                await approveReceipt(id);
                setItems((prev) => prev.filter((x) => String(x.id) !== id));
              } catch (e) {
                Alert.alert('Lỗi', getErrorMessage(e, 'Không phê duyệt được'));
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]);
    },
    [],
  );

  const runReject = useCallback((r: Receipt) => {
    const id = String(r.id);
    Alert.alert('Từ chối phiếu', 'Bạn có chắc muốn từ chối phiếu này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId(id);
            try {
              await rejectReceipt(id, { rejectedReason: 'Từ chối từ app' });
              setItems((prev) => prev.filter((x) => String(x.id) !== id));
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không từ chối được'));
            } finally {
              setBusyId(null);
            }
          })();
        },
      },
    ]);
  }, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.compactHeader}>
        <View style={styles.searchRowFull}>
          <View style={os.searchFieldWrap}>
            <MaterialIcons name="search" size={18} color={S.outline} style={os.searchFieldIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm tài xế, khu, mã phiếu…"
              placeholderTextColor={`${S.outline}99`}
              style={os.searchFieldInput}
            />
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={os.chipsContent}>
          {STATUS_TABS.map((t) => {
            const selected = statusTab === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setStatusTab(t.value)}
                style={[os.chip, selected && os.chipSelected]}>
                <Text style={[os.chipText, selected && os.chipTextSelected]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    ),
    [searchQuery, statusTab],
  );

  const listFooter = useMemo(
    () => (
      <View style={styles.footerBlock}>
        {loadingMore ? <ActivityIndicator color={S.primary} style={styles.footerLoader} /> : null}
        <View style={styles.footerTip}>
          <MaterialIcons name="move-to-inbox" size={22} color={S.onSurfaceVariant} />
          <Text style={styles.footerTipText}>
            {statusTab === 'all'
              ? 'Kéo xuống cuối danh sách hoặc chạm Tải thêm để xem thêm phiếu.'
              : statusTab === 'pending'
                ? 'Kéo xuống cuối danh sách hoặc chạm Tải thêm để xem thêm phiếu chờ duyệt.'
                : 'Kéo xuống cuối danh sách hoặc chạm Tải thêm để xem thêm phiếu trong trạng thái này.'}
          </Text>
        </View>
        {hasNext ? (
          <Pressable onPress={() => void onLoadMore()} style={styles.loadMoreBtn}>
            <Text style={styles.loadMoreText}>Tải thêm</Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [hasNext, loadingMore, onLoadMore, statusTab],
  );

  if (forbidden && !loading) {
    return (
      <View style={os.root}>
        <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={styles.topBarTitleRow}>
            <Image source={PHIEU_ICON} style={styles.topBarIcon} contentFit="contain" />
            <Text style={styles.topBarTitle} numberOfLines={1}>
              Phiếu cân
            </Text>
          </View>
        </View>
        <View style={os.hairline} />
        <View style={os.blockedCard}>
          <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="lock-outline" size={40} color={S.tertiary} style={{ opacity: 0.5 }} />
          </View>
          <View style={os.blockedBody}>
            <Text style={os.blockedTitle}>Không có quyền xem</Text>
            <Text style={os.blockedText}>
              Backend trả 403 — chỉ owner/admin mới xem được danh sách phiếu theo phạm vi khu.
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
        <View style={styles.topBarTitleRow}>
          <Image source={PHIEU_ICON} style={styles.topBarIcon} contentFit="contain" />
          <Text style={styles.topBarTitle} numberOfLines={1}>
            Phiếu cân
          </Text>
        </View>
        <View style={os.topBarRight}>
          <Pressable
            accessibilityLabel="Tạo phiếu cân"
            onPress={() => router.push('/receipt/form')}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
            <MaterialIcons name="add" size={26} color={S.primary} />
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
        <SectionList
          sections={receiptSections}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.listContentTight}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.primary} />
          }
          onEndReached={() => void onLoadMore()}
          onEndReachedThreshold={0.35}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ReceiptCard
              item={item}
              busy={busyId === String(item.id)}
              onApprove={() => runApprove(item)}
              onReject={() => runReject(item)}
              onPreview={() => {
                const urls = collectReceiptImageUrls(item);
                if (urls.length) setImageLightbox({ urls, index: 0 });
              }}
              onOpenDetail={() => router.push(`/receipt/${String(item.id)}`)}
            />
          )}
          ListEmptyComponent={
            !loading && !error ? (
              <Text style={os.empty}>
                {searchQuery.trim()
                  ? 'Không có phiếu khớp tìm kiếm.'
                  : statusTab === 'all'
                    ? 'Không có phiếu.'
                    : statusTab === 'pending'
                      ? 'Không có phiếu chờ duyệt.'
                      : 'Không có phiếu trong trạng thái này.'}
              </Text>
            ) : null
          }
          style={os.flatListFlex}
        />
      )}

      <ReceiptImageLightbox
        visible={imageLightbox != null && imageLightbox.urls.length > 0}
        urls={imageLightbox?.urls ?? []}
        initialIndex={imageLightbox?.index ?? 0}
        onClose={() => setImageLightbox(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  topBarIcon: {
    width: 32,
    height: 32,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: S.primary,
    flex: 1,
  },
  compactHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  searchRowFull: {
    width: '100%',
    marginBottom: 4,
  },
  chipsScroll: {
    marginTop: 8,
  },
  listContentTight: {
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  sectionHeader: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 4,
    marginBottom: 4,
    backgroundColor: Brand.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${S.outlineVariant}4d`,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: 0.15,
  },
  footerBlock: {
    paddingBottom: 32,
    paddingTop: 8,
  },
  footerLoader: {
    marginBottom: 12,
  },
  footerTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  footerTipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: S.onSurfaceVariant,
  },
  loadMoreBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: S.primary,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

const cardStyles = StyleSheet.create({
  slipOuter: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
  },
  slipBody: {
    padding: 12,
    backgroundColor: Brand.surface,
    borderBottomWidth: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: '#e8e8e8',
    borderRightColor: '#e8e8e8',
    borderTopWidth: 5,
  },
  cardMainPress: {
    borderRadius: 0,
  },
  cardMainPressPressed: {
    opacity: 0.96,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTopPress: {
    flex: 1,
    minWidth: 0,
  },
  cardTopInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: `${S.outlineVariant}aa`,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: S.surfaceContainerLow,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  driverName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    color: Brand.ink,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaSep: {
    fontSize: 12,
    color: S.outline,
    fontWeight: '600',
  },
  idLine: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '42%',
    color: S.onSurfaceVariant,
  },
  dateLine: {
    fontSize: 12,
    fontWeight: '500',
    color: S.onSurfaceVariant,
    marginTop: 6,
    letterSpacing: 0.1,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  pillPendingGray: {
    backgroundColor: '#b2ebf2',
  },
  pillOk: {
    backgroundColor: '#c8e6c9',
  },
  pillReject: {
    backgroundColor: '#ffcdd2',
  },
  pillMuted: {
    backgroundColor: S.surfaceContainerHigh,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillTextGray: {
    color: '#00838f',
  },
  pillTextOk: {
    color: S.primary,
  },
  pillTextReject: {
    color: '#b71c1c',
  },
  pillTextMuted: {
    color: S.onSurfaceVariant,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${S.primary}12`,
  },
  zoomBtnMuted: {
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.surfaceContainerLow,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${S.outlineVariant}88`,
  },
  heroWeight: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
    color: Brand.ink,
  },
  heroMoney: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 0,
    textAlign: 'right',
    maxWidth: '52%',
    color: S.primary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  areaMuted: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: S.onSurfaceVariant,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}`,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnPressed: {
    backgroundColor: S.surfaceContainerLow,
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: S.onSurfaceVariant,
  },
  approveBtnWrap: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  approveBtnGrad: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  approveBtnPressed: {
    opacity: 0.92,
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  doneHint: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
    color: S.onSurfaceVariant,
  },
});
