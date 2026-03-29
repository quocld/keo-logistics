import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';
import { getErrorMessage } from '@/lib/api/errors';
import { approveReceipt, listReceipts, rejectReceipt } from '@/lib/api/receipts';
import { firstReceiptImageUrl } from '@/lib/receipt/receipt-image-urls';
import type { Receipt } from '@/lib/types/ops';

const S = Brand.stitch;
const PAGE_SIZE = 10;

const STATUS_TABS: { value: string; label: string }[] = [
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

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN')} VND`;
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

  return (
    <View style={cardStyles.wrap}>
      <View style={cardStyles.cardTop}>
        <Pressable
          onPress={onOpenDetail}
          style={({ pressed }) => [cardStyles.cardTitlePress, pressed && cardStyles.cardTitlePressPressed]}
          accessibilityRole="button"
          accessibilityLabel="Xem chi tiết phiếu">
          <View style={cardStyles.cardTitleBlock}>
            <Text style={cardStyles.driverName}>{driverName(item)}</Text>
            <View style={cardStyles.metaRow}>
              <Text style={cardStyles.idLine}>ID: {displayId}</Text>
              <View style={[cardStyles.pill, pending ? cardStyles.pillPending : cardStyles.pillMuted]}>
                <Text style={[cardStyles.pillText, pending ? cardStyles.pillTextPending : cardStyles.pillTextMuted]}>
                  {statusPillLabel(st)}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
        {hasImage ? (
          <Pressable
            onPress={onPreview}
            style={({ pressed }) => [cardStyles.zoomBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Xem ảnh phiếu">
            <MaterialIcons name="zoom-in" size={22} color={S.primary} />
          </Pressable>
        ) : (
          <View style={cardStyles.zoomBtnMuted}>
            <MaterialIcons name="image-not-supported" size={20} color={`${S.outline}88`} />
          </View>
        )}
      </View>

      <Pressable
        onPress={onOpenDetail}
        style={({ pressed }) => [cardStyles.cardBodyPress, pressed && cardStyles.cardBodyPressPressed]}
        accessibilityRole="button"
        accessibilityLabel="Xem chi tiết phiếu">
        <View style={cardStyles.metrics}>
          <View style={cardStyles.metricRow}>
            <Text style={cardStyles.metricLabel}>Weight (Tấn)</Text>
            <Text style={cardStyles.metricValue}>{weight != null ? String(weight) : '—'}</Text>
          </View>
          <View style={cardStyles.metricRow}>
            <Text style={cardStyles.metricLabel}>Harvest Area</Text>
            <Text style={cardStyles.metricValue} numberOfLines={2}>
              {harvestAreaLine(item)}
            </Text>
          </View>
          <View style={cardStyles.metricRow}>
            <Text style={cardStyles.metricLabel}>Total Value</Text>
            <Text style={cardStyles.metricValue}>{amount != null ? formatVnd(amount) : '—'}</Text>
          </View>
        </View>

        <View style={cardStyles.detailHintRow}>
          <Text style={cardStyles.detailHintText}>Xem chi tiết phiếu</Text>
          <MaterialIcons name="chevron-right" size={20} color={S.primary} />
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
              cardStyles.approveBtn,
              pressed && cardStyles.approveBtnPressed,
              busy && cardStyles.btnDisabled,
            ]}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={cardStyles.approveBtnText}>Phê duyệt</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Text style={cardStyles.doneHint}>Phiếu đã xử lý — không thể thao tác lại từ đây.</Text>
      )}
    </View>
  );
}

export default function ReceiptApprovalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Receipt[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [statusTab, setStatusTab] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const res = await listReceipts({
        page: nextPage,
        limit: PAGE_SIZE,
        status: statusTab || undefined,
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
      <View style={os.mainHeader}>
        <Text style={os.eyebrow}>KeoTram Ops</Text>
        <Text style={os.sectionTitle}>Phê duyệt Phiếu cân</Text>
        <Text style={styles.enSub}>
          Review and authorize weight receipts for incoming timber shipments.
        </Text>
        <View style={os.heroSearchRow}>
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
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={({ pressed }) => [os.filterCompact, pressed && os.filterBtnPressed]}>
            <MaterialIcons name="filter-list" size={20} color={S.primary} />
            <Text style={os.filterBtnText}>Lọc</Text>
          </Pressable>
        </View>
        {filtersOpen ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
        ) : null}
      </View>
    ),
    [filtersOpen, searchQuery, statusTab],
  );

  const listFooter = useMemo(
    () => (
      <View style={styles.footerBlock}>
        {loadingMore ? <ActivityIndicator color={S.primary} style={styles.footerLoader} /> : null}
        <View style={styles.footerTip}>
          <MaterialIcons name="move-to-inbox" size={22} color={S.onSurfaceVariant} />
          <Text style={styles.footerTipText}>
            Cần xem thêm hồ sơ? Kéo để tải thêm dữ liệu chờ duyệt.
          </Text>
        </View>
        {hasNext ? (
          <Pressable onPress={() => void onLoadMore()} style={styles.loadMoreBtn}>
            <Text style={styles.loadMoreText}>Tải thêm</Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [hasNext, loadingMore, onLoadMore],
  );

  if (forbidden && !loading) {
    return (
      <View style={os.root}>
        <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={os.topBarLeft}>
            <MaterialIcons name="receipt-long" size={26} color={Brand.forest} />
            <Text style={os.topTitleStitch} numberOfLines={1}>
              Phê duyệt phiếu
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
        <View style={os.topBarLeft}>
          <MaterialIcons name="receipt-long" size={26} color={Brand.forest} />
          <Text style={os.topTitleStitch} numberOfLines={1}>
            Phê duyệt phiếu
          </Text>
        </View>
        <View style={os.topBarRight}>
          <Pressable
            accessibilityLabel="Tạo phiếu cân"
            onPress={() => router.push('/receipt/form')}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
            <MaterialIcons name="add" size={26} color={S.primary} />
          </Pressable>
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}>
            <MaterialIcons name="tune" size={22} color={S.onSurfaceVariant} />
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
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={os.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.primary} />
          }
          onEndReached={() => void onLoadMore()}
          onEndReachedThreshold={0.35}
          renderItem={({ item }) => (
            <ReceiptCard
              item={item}
              busy={busyId === String(item.id)}
              onApprove={() => runApprove(item)}
              onReject={() => runReject(item)}
              onPreview={() => {
                const u = firstReceiptImageUrl(item);
                if (u) setPreviewUrl(u);
              }}
              onOpenDetail={() => router.push(`/receipt/${String(item.id)}`)}
            />
          )}
          ListEmptyComponent={
            !loading && !error ? (
              <Text style={os.empty}>
                {searchQuery.trim()
                  ? 'Không có phiếu khớp tìm kiếm.'
                  : statusTab === 'pending'
                    ? 'Không có phiếu chờ duyệt.'
                    : 'Không có phiếu trong trạng thái này.'}
              </Text>
            ) : null
          }
          style={os.flatListFlex}
        />
      )}

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
  enSub: {
    fontSize: 14,
    lineHeight: 20,
    color: `${S.onSurfaceVariant}cc`,
    marginTop: 8,
    marginBottom: 4,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
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
    fontWeight: '700',
    color: Brand.ink,
  },
  modalImage: {
    width: '100%',
    height: 360,
    backgroundColor: '#000',
  },
});

const cardStyles = StyleSheet.create({
  wrap: {
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}99`,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitlePress: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  cardTitlePressPressed: {
    opacity: 0.92,
  },
  cardBodyPress: {
    borderRadius: 0,
  },
  cardBodyPressPressed: {
    opacity: 0.96,
  },
  cardTitleBlock: {
    minWidth: 0,
  },
  detailHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  detailHintText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  idLine: {
    fontSize: 13,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillPending: {
    backgroundColor: `${S.tertiary}22`,
  },
  pillMuted: {
    backgroundColor: S.surfaceContainerHigh,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pillTextPending: {
    color: S.tertiary,
  },
  pillTextMuted: {
    color: S.onSurfaceVariant,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${S.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnMuted: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: S.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: {
    gap: 12,
    marginBottom: 18,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricLabel: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    width: 118,
  },
  metricValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.ink,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${S.outlineVariant}`,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnPressed: {
    backgroundColor: S.surfaceContainerLow,
  },
  rejectBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: S.onSurfaceVariant,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: S.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnPressed: {
    opacity: 0.92,
  },
  approveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  doneHint: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    fontStyle: 'italic',
  },
});
