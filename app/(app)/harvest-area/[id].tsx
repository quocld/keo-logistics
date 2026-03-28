import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { deleteHarvestArea, getHarvestArea } from '@/lib/api/harvest-areas';
import type { HarvestArea } from '@/lib/types/ops';

const S = Brand.stitch;

function row(label: string, value: string) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function HarvestAreaDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = typeof idParam === 'string' ? idParam : idParam?.[0];
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [item, setItem] = useState<HarvestArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getHarvestArea(id);
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

  useLayoutEffect(() => {
    if (item?.name) {
      navigation.setOptions({ title: item.name });
    }
  }, [navigation, item?.name]);

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
              Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xóa được');
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  }, [id, router]);

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

  const ha = item.areaHectares != null ? String(item.areaHectares) : '—';
  const tons = item.targetTons != null ? String(item.targetTons) : '—';
  const lat =
    item.latitude != null && item.longitude != null
      ? `${item.latitude}, ${item.longitude}`
      : '—';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {row('Trạng thái', String(item.status))}
      {row('Diện tích (ha)', ha)}
      {row('Mục tiêu (tấn)', tons)}
      {row('Tọa độ', lat)}
      {row('Google Place ID', item.googlePlaceId ? String(item.googlePlaceId) : '—')}
      {row('Liên hệ bãi', item.siteContactName ? String(item.siteContactName) : '—')}
      {row('SĐT liên hệ', item.siteContactPhone ? String(item.siteContactPhone) : '—')}
      {row('Email liên hệ', item.siteContactEmail ? String(item.siteContactEmail) : '—')}
      {row('Ngày mua bãi', item.sitePurchaseDate ? String(item.sitePurchaseDate) : '—')}
      {item.siteNotes ? row('Ghi chú', String(item.siteNotes)) : null}
      {user?.role === 'admin' && item.ownerId != null ? row('Owner ID', String(item.ownerId)) : null}

      <Pressable
        onPress={() => router.push({ pathname: '/harvest-area/form', params: { id: String(id) } })}
        style={styles.btnPrimary}>
        <MaterialIcons name="edit" size={20} color="#fff" />
        <Text style={styles.btnPrimaryText}>Chỉnh sửa</Text>
      </Pressable>

      <Pressable
        onPress={onDelete}
        disabled={deleting}
        style={[styles.btnDanger, deleting && styles.btnDisabled]}>
        <MaterialIcons name="delete-outline" size={20} color="#ba1a1a" />
        <Text style={styles.btnDangerText}>{deleting ? 'Đang xóa…' : 'Xóa khu'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.canvas,
  },
  row: {
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
    paddingBottom: 12,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: S.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 16,
    color: Brand.ink,
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
  btnPrimary: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: S.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnDanger: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffdad6',
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnDangerText: {
    color: '#ba1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
