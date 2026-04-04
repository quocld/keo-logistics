import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';
import { getErrorMessage } from '@/lib/api/errors';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';
import { NOTIFICATION_REFRESH_UNREAD_EVENT } from '@/lib/push/notification-events';
import type { NotificationInboxItem } from '@/lib/types/ops';

const S = Brand.stitch;
const PAGE_SIZE = 20;

type FilterTab = 'all' | 'unread';

function notificationHeading(n: NotificationInboxItem): string {
  const t = n.title?.trim();
  if (t) return t;
  return 'Thông báo';
}

function notificationBodyText(n: NotificationInboxItem): string {
  const b = n.body?.trim() || n.message?.trim();
  if (b) return b;
  return '';
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationInboxItem;
  onPress: () => void;
}) {
  const title = notificationHeading(item);
  const preview = notificationBodyText(item);
  const when = formatWhen(item.createdAt);
  return (
    <Pressable onPress={onPress} style={os.stitchCard}>
      <View style={[os.stitchAccent, { backgroundColor: item.isRead ? S.outlineVariant : S.primary }]} />
      <View style={os.stitchCardInner}>
        <View style={styles.rowHead}>
          <View style={styles.titleBlock}>
            {!item.isRead ? <View style={styles.unreadDot} /> : <View style={styles.unreadPlaceholder} />}
            <Text style={[os.stitchCardTitle, !item.isRead && styles.titleUnread]} numberOfLines={2}>
              {title}
            </Text>
          </View>
        </View>
        {when ? <Text style={styles.whenLine}>{when}</Text> : null}
        {preview ? (
          <Text style={os.stitchSubLine} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
        <View style={styles.cardFooter} pointerEvents="none">
          <Text style={styles.cardAction}>Xem chi tiết</Text>
          <MaterialIcons name="chevron-right" size={22} color={S.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readAllBusy, setReadAllBusy] = useState(false);
  const [detail, setDetail] = useState<NotificationInboxItem | null>(null);

  const listParams = useMemo(() => {
    if (filter === 'unread') {
      return { isRead: false as const };
    }
    return {};
  }, [filter]);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const res = await listNotifications({
        page: nextPage,
        limit: PAGE_SIZE,
        ...listParams,
      });
      if (append) {
        setItems((prev) => [...prev, ...res.data]);
      } else {
        setItems(res.data);
      }
      setHasNext(res.hasNextPage);
      setPage(nextPage);
    },
    [listParams],
  );

  const initialLoad = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loadPage(1, false);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được thông báo'));
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadPage(1, false);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải được thông báo'));
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch (e) {
      setError(getErrorMessage(e, 'Không tải thêm được'));
    } finally {
      setLoadingMore(false);
    }
  }, [hasNext, loadPage, loading, loadingMore, page]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NOTIFICATION_REFRESH_UNREAD_EVENT, () => {
      void onRefresh();
    });
    return () => sub.remove();
  }, [onRefresh]);

  const onPressRow = useCallback(
    async (item: NotificationInboxItem) => {
      setDetail(item);
      if (!item.isRead) {
        try {
          const updated = await markNotificationRead(item.id);
          setDetail(updated);
          setItems((prev) =>
            prev.map((row) => (row.id === item.id ? { ...row, ...updated, isRead: true } : row)),
          );
        } catch (e) {
          setError(getErrorMessage(e, 'Không đánh dấu đã đọc'));
        }
      }
    },
    [],
  );

  const onReadAll = useCallback(async () => {
    setReadAllBusy(true);
    setError(null);
    try {
      await markAllNotificationsRead();
      await loadPage(1, false);
    } catch (e) {
      setError(getErrorMessage(e, 'Không cập nhật được'));
    } finally {
      setReadAllBusy(false);
    }
  }, [loadPage]);

  const closeDetail = useCallback(() => {
    setDetail(null);
  }, []);

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [os.iconBtn, pressed && os.iconBtnPressed]}
            accessibilityLabel="Quay lại">
            <MaterialIcons name="arrow-back" size={24} color={S.onSurfaceVariant} />
          </Pressable>
          <Text style={os.topTitleStitch} numberOfLines={1}>
            Thông báo
          </Text>
        </View>
        <View style={os.topBarRight}>
          <Pressable
            onPress={() => void onReadAll()}
            disabled={readAllBusy || items.length === 0}
            style={({ pressed }) => [styles.readAllBtn, pressed && styles.readAllBtnPressed]}
            accessibilityLabel="Đánh dấu đã đọc tất cả">
            {readAllBusy ? (
              <ActivityIndicator size="small" color={S.primary} />
            ) : (
              <Text style={styles.readAllText}>Đọc hết</Text>
            )}
          </Pressable>
        </View>
      </View>
      <View style={os.hairline} />

      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setFilter('all')}
          style={[styles.segmentChip, filter === 'all' && styles.segmentChipActive]}>
          <Text style={[styles.segmentLabel, filter === 'all' && styles.segmentLabelActive]}>Tất cả</Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter('unread')}
          style={[styles.segmentChip, filter === 'unread' && styles.segmentChipActive]}>
          <Text style={[styles.segmentLabel, filter === 'unread' && styles.segmentLabelActive]}>
            Chưa đọc
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={20} color="#c62828" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={S.primary} />
        </View>
      ) : (
        <FlatList
          style={os.flatListFlex}
          contentContainerStyle={[styles.listPad, { paddingBottom: insets.bottom + 24 }]}
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={({ item }) => (
            <NotificationRow item={item} onPress={() => void onPressRow(item)} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="notifications-none" size={48} color={S.onSurfaceVariant} />
              <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
              <Text style={styles.emptySub}>Khi có cập nhật, bạn sẽ thấy tại đây.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoad}>
                <ActivityIndicator color={S.primary} />
              </View>
            ) : null
          }
        />
      )}

      <Modal visible={detail != null} transparent animationType="fade" onRequestClose={closeDetail}>
        <Pressable style={styles.modalBackdrop} onPress={closeDetail}>
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}>
              {detail ? (
                <>
                  <Text style={styles.modalTitle}>{notificationHeading(detail)}</Text>
                  {formatWhen(detail.createdAt) ? (
                    <Text style={styles.modalWhen}>{formatWhen(detail.createdAt)}</Text>
                  ) : null}
                  <Text style={styles.modalBody}>
                    {notificationBodyText(detail) || 'Không có nội dung chi tiết.'}
                  </Text>
                </>
              ) : null}
            </ScrollView>
            <Pressable
              onPress={closeDetail}
              style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.9 }]}>
              <Text style={styles.modalCloseText}>Đóng</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  segmentChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: S.surfaceContainerLow,
  },
  segmentChipActive: {
    backgroundColor: `${S.primary}22`,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  segmentLabelActive: {
    color: S.primary,
  },
  readAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readAllBtnPressed: {
    backgroundColor: S.surfaceContainerLow,
  },
  readAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: S.primary,
  },
  rowHead: {
    marginBottom: 4,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: S.primary,
    marginTop: 6,
  },
  unreadPlaceholder: {
    width: 8,
    height: 8,
    marginTop: 6,
  },
  titleUnread: {
    fontWeight: '700',
  },
  whenLine: {
    fontSize: 12,
    color: S.onSurfaceVariant,
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  cardAction: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  listPad: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffebee',
  },
  errorText: {
    flex: 1,
    color: '#c62828',
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.ink,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: S.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  footerLoad: {
    paddingVertical: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: Brand.canvas,
    borderRadius: 16,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalScrollContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 8,
  },
  modalWhen: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    marginBottom: 16,
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
    color: Brand.inkMuted,
  },
  modalClose: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.outlineVariant,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: S.primary,
  },
});

