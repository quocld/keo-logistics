import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

import { stitchHarvestFormStyles as headerStyles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { deleteHarvestArea, getHarvestArea } from '@/lib/api/harvest-areas';
import {
  appendHarvestAreaForOwnerDriver,
  getOwnerDriverHarvestAreas,
  listAllOwnerDrivers,
  removeHarvestAreaFromOwnerDriver,
} from '@/lib/api/owner-drivers';
import { aggregateDriversFromTrips, listTrips } from '@/lib/api/trips';
import type { HarvestArea, OwnerDriverUser, Trip } from '@/lib/types/ops';

const S = Brand.stitch;

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
  const n = String(id).replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `KKT-${n}`;
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

function tripPlate(t: Trip): string {
  const v =
    (t as { vehiclePlate?: unknown }).vehiclePlate ??
    (t as { licensePlate?: unknown }).licensePlate ??
    (t as { plate?: unknown }).plate;
  return v != null && String(v).trim() ? String(v) : '—';
}

function tripWeightLine(t: Trip): string {
  const tons =
    (t as { cargoWeightTons?: unknown }).cargoWeightTons ??
    (t as { weightTons?: unknown }).weightTons ??
    (t as { netWeightTons?: unknown }).netWeightTons;
  if (tons != null && Number.isFinite(Number(tons))) {
    return `${Number(tons)} tấn`;
  }
  return '—';
}

function tripTimeShort(t: Trip): string {
  const raw = t.updatedAt ?? t.createdAt;
  if (!raw || typeof raw !== 'string') return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function tripWeighingLabel(t: Trip): string {
  const w = (t as { weighingStation?: { name?: string } | null }).weighingStation;
  if (w && typeof w === 'object' && w.name) return String(w.name);
  const id = (t as { weighingStationId?: unknown }).weighingStationId;
  if (id != null && id !== '') return `Trạm #${id}`;
  return '—';
}

function driverNameFromTrip(t: Trip): string {
  const ref = t.driver;
  if (ref && typeof ref === 'object') {
    const parts = [ref.firstName, ref.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    if (ref.email) return ref.email;
  }
  if (t.driverId != null && t.driverId !== '') return `Tài xế #${t.driverId}`;
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

function pickNumberField(item: HarvestArea, keys: string[]): number | null {
  for (const k of keys) {
    const v = item[k];
    if (v != null && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
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
  const [tripsLoading, setTripsLoading] = useState(false);
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
    setTripsLoading(true);
    try {
      const res = await listTrips({ page: 1, limit: 25, harvestAreaId: id });
      const forArea = res.data.filter(
        (t) => String(t.harvestAreaId ?? '') === String(id),
      );
      setTrips(forArea.length ? forArea : res.data);
    } catch {
      setTrips([]);
    } finally {
      setTripsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (item) void loadTrips();
  }, [item, loadTrips]);

  const loadAssignedOwnerDrivers = useCallback(async () => {
    if (!id || user?.role !== 'owner') return;
    setAssignedDriversLoading(true);
    try {
      const drivers = await listAllOwnerDrivers();
      setAllManagedDrivers(drivers);
      const areaKey = String(id);
      const withAreas = await Promise.all(
        drivers.map(async (d) => {
          try {
            const areas = await getOwnerDriverHarvestAreas(d.id);
            return { driver: d, areas };
          } catch {
            return { driver: d, areas: [] as HarvestArea[] };
          }
        }),
      );
      const assigned = withAreas
        .filter(({ areas }) => areas.some((a) => String(a.id) === areaKey))
        .map(({ driver }) => driver);
      setAssignedOwnerDrivers(assigned);
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
    item != null
      ? pickNumberField(item, ['currentYieldTons', 'actualTons', 'harvestedTons'])
      : null;
  const yieldText =
    currentYield != null
      ? `${currentYield.toLocaleString('vi-VN')} tấn`
      : item?.targetTons != null
        ? `${Number(item.targetTons).toLocaleString('vi-VN')} tấn (mục tiêu)`
        : '—';
  const profitText = useMemo(() => {
    if (!item) return '—';
    const v = pickNumberField(item, ['estimatedProfitVnd', 'expectedProfitVnd', 'profitEstimateVnd']);
    if (v == null) return '—';
    if (v >= 1_000_000) {
      return `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}M VND`;
    }
    return `${v.toLocaleString('vi-VN')} VND`;
  }, [item]);

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

  const lat =
    item.latitude != null && item.longitude != null
      ? `${Number(item.latitude).toFixed(4)}° N, ${Number(item.longitude).toFixed(4)}° E`
      : null;

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
        <View style={headerStyles.headerRight}>
          <Pressable style={headerStyles.headerIconBtn} hitSlop={8}>
            <MaterialIcons name="notifications-none" size={22} color={Brand.ink} />
          </Pressable>
          <View style={headerStyles.headerDivider} />
          <Pressable
            style={headerStyles.helpBtn}
            hitSlop={8}
            onPress={() =>
              Alert.alert('Hỗ trợ', 'GET /harvest-areas/:id, GET /trips?harvestAreaId=… — KeoTram Ops Postman.')
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
          <Text style={styles.areaCodeLine}>Mã khu vực: {formatAreaRegionCode(item.id)}</Text>
          <Text style={styles.heroTitle}>{item.name}</Text>
          <View style={styles.heroStatusRow}>
            <View style={[styles.statusPill, { backgroundColor: pillColors.bg }]}>
              <Text style={[styles.statusPillText, { color: pillColors.fg }]} numberOfLines={1}>
                {statusHeadlineVi(st).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.addrRow}>
            <MaterialIcons name="location-on" size={20} color={S.primary} style={styles.addrIcon} />
            <Text style={styles.addrText}>
              {lat ?? (item.googlePlaceId ? `Place ID: ${item.googlePlaceId}` : 'Chưa có tọa độ')}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push({ pathname: '/harvest-area/form', params: { id: String(id) } })}
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
              <Text style={styles.btnOutlineDangerText}>{deleting ? 'Đang xóa…' : 'Xóa khu'}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsScroll}>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Tổng diện tích</Text>
            <Text style={styles.metricValue}>{areaHa}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Sản lượng hiện tại</Text>
            <Text style={styles.metricValue} numberOfLines={2}>
              {yieldText}
            </Text>
            {currentYield == null && item.targetTons == null ? (
              <Text style={styles.metricHint}>Cập nhật khi đồng bộ sản lượng thực tế</Text>
            ) : null}
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricEyebrow}>Lợi nhuận dự kiến</Text>
            <Text style={styles.metricValue} numberOfLines={2}>
              {profitText}
            </Text>
            {profitText === '—' ? (
              <Text style={styles.metricHint}>Ước tính khi backend cung cấp trường lợi nhuận</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.mapCard}>
          <Text style={styles.mapEyebrow}>Vị trí khu</Text>
          <View style={styles.mapVisual}>
            <LinearGradient
              colors={['#e8f5e9', S.surfaceContainerLow, '#c8e6c9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <MaterialIcons name="map" size={44} color={S.primary} style={{ opacity: 0.75 }} />
            <Text style={styles.mapCoord}>
              {lat ?? 'Thêm vĩ độ / kinh độ trong form chỉnh sửa khu'}
            </Text>
          </View>
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
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Lịch sử chuyến gần đây</Text>
            <Pressable
              hitSlop={8}
              onPress={() =>
                Alert.alert('Xem tất cả', 'Danh sách trip đầy đủ có thể mở rộng từ API /trips với phân trang.')
              }
              style={styles.seeAllRow}>
              <Text style={styles.linkText}>Xem tất cả</Text>
              <MaterialIcons name="chevron-right" size={20} color={S.primary} />
            </Pressable>
          </View>
          {tripsLoading ? (
            <ActivityIndicator color={S.primary} style={{ marginVertical: 16 }} />
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.thPlate]}>Biển số</Text>
                <Text style={[styles.th, styles.thDriver]}>Tài xế</Text>
                <Text style={[styles.th, styles.thWt]}>Trọng lượng</Text>
                <Text style={[styles.th, styles.thTime]}>Thời gian</Text>
                <Text style={[styles.th, styles.thStation]}>Trạm cân</Text>
              </View>
              {trips.length === 0 && !tripsLoading ? (
                <View style={styles.tableEmpty}>
                  <MaterialIcons name="local-shipping" size={32} color={`${S.outline}66`} />
                  <Text style={styles.tableEmptyText}>Chưa có chuyến cho khu này.</Text>
                </View>
              ) : (
                trips.slice(0, 6).map((t) => (
                  <View key={String(t.id)} style={styles.tableRow}>
                    <Text style={[styles.td, styles.thPlate]} numberOfLines={1}>
                      {tripPlate(t)}
                    </Text>
                    <Text style={[styles.td, styles.thDriver]} numberOfLines={1}>
                      {driverNameFromTrip(t)}
                    </Text>
                    <Text style={[styles.td, styles.thWt]} numberOfLines={1}>
                      {tripWeightLine(t)}
                    </Text>
                    <Text style={[styles.td, styles.thTime]} numberOfLines={1}>
                      {tripTimeShort(t)}
                    </Text>
                    <Text style={[styles.td, styles.thStation]} numberOfLines={1}>
                      {tripWeighingLabel(t)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>

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
            <Text style={styles.infoLabel}>Ngày mua bãi</Text>
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
  areaCodeLine: {
    fontSize: 13,
    fontWeight: '600',
    color: S.onSurfaceVariant,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: Brand.ink,
    marginBottom: 10,
  },
  heroStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 18,
  },
  addrIcon: { marginTop: 1 },
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
  disabled: { opacity: 0.55 },
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
    height: 140,
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
    paddingHorizontal: 16,
    textAlign: 'center',
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
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  tableWrap: {
    minWidth: 520,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
    paddingBottom: 8,
    marginBottom: 4,
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
  },
  thPlate: { width: 88, paddingRight: 6 },
  thDriver: { width: 110, paddingRight: 6 },
  thWt: { width: 78, paddingRight: 6 },
  thTime: { width: 96, paddingRight: 6 },
  thStation: { flex: 1, minWidth: 100 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${S.outlineVariant}99`,
  },
  td: {
    fontSize: 13,
    color: Brand.ink,
  },
  tableEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  tableEmptyText: {
    fontSize: 14,
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
