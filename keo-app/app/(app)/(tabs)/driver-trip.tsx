import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ownerStitchListStyles as os } from '@/components/owner/owner-stitch-list-styles';
import { Brand } from '@/constants/brand';
import { useDriverTrip } from '@/contexts/driver-trip-context';
import { useAuth } from '@/contexts/auth-context';
import { flushLocationQueue } from '@/lib/api/driver-location';
import { getErrorMessage } from '@/lib/api/errors';
import { listHarvestAreas } from '@/lib/api/harvest-areas';
import { listWeighingStations } from '@/lib/api/weighing-stations';
import { isTrackingRunning } from '@/lib/tracking/driver-tracking';
import type { HarvestArea, WeighingStation } from '@/lib/types/ops';

const S = Brand.stitch;

export default function DriverTripScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const {
    activeTrip,
    trackingDesired,
    hydrated,
    lastError,
    busy,
    refresh,
    setTrackingEnabled,
    createAndStartTrip,
    completeActiveTrip,
    cancelActiveTrip,
    startPlannedActiveTrip,
  } = useDriverTrip();

  const [areas, setAreas] = useState<HarvestArea[]>([]);
  const [stations, setStations] = useState<WeighingStation[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsErr, setListsErr] = useState<string | null>(null);
  const [areaId, setAreaId] = useState('');
  const [stationId, setStationId] = useState('');
  const [areaModal, setAreaModal] = useState(false);
  const [stationModal, setStationModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gpsRunning, setGpsRunning] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'driver') {
      router.replace('/(app)/(tabs)');
    }
  }, [user, router]);

  const loadLists = useCallback(async () => {
    setListsErr(null);
    setListsLoading(true);
    try {
      const ha = await listHarvestAreas({ page: 1, limit: 200 });
      setAreas(ha.data);
      const ws = await listWeighingStations({ page: 1, limit: 200 });
      if (ws.ok) {
        setStations(ws.body.data);
      } else if (ws.forbidden) {
        setStations([]);
        setListsErr('Không tải được danh sách trạm (403). Vẫn có thể thử tạo chuyến nếu API cho phép.');
      } else {
        setStations([]);
        setListsErr(ws.message);
      }
    } catch (e) {
      setListsErr(getErrorMessage(e, 'Không tải danh sách'));
      setAreas([]);
      setStations([]);
    } finally {
      setListsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'driver') {
      void loadLists();
    }
  }, [user?.role, loadLists]);

  const syncGpsRunning = useCallback(async () => {
    const r = await isTrackingRunning();
    setGpsRunning(r);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void syncGpsRunning();
      void refresh();
      void flushLocationQueue();
    }, [syncGpsRunning, refresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void flushLocationQueue();
        void syncGpsRunning();
      }
    });
    return () => sub.remove();
  }, [syncGpsRunning]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      await flushLocationQueue();
      await syncGpsRunning();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, syncGpsRunning]);

  const areaLabel = areas.find((x) => String(x.id) === areaId)?.name ?? 'Chọn khu khai thác';
  const stationLabel = stations.find((x) => String(x.id) === stationId)?.name ?? 'Chọn trạm cân';

  const onCreateStart = useCallback(async () => {
    if (!areaId || !stationId) {
      Alert.alert('Thiếu dữ liệu', 'Chọn khu và trạm cân.');
      return;
    }
    try {
      await createAndStartTrip({
        harvestAreaId: areaId,
        weighingStationId: stationId,
        startNow: true,
      });
      Alert.alert('Đã tạo chuyến', 'Bạn có thể bật theo dõi GPS khi sẵn sàng xuất phát.');
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tạo được chuyến.'));
    }
  }, [areaId, stationId, createAndStartTrip]);

  const onToggleGps = useCallback(
    async (on: boolean) => {
      const r = await setTrackingEnabled(on);
      await syncGpsRunning();
      if (!r.ok && r.message) {
        Alert.alert('GPS', r.message);
      }
    },
    [setTrackingEnabled, syncGpsRunning],
  );

  const onComplete = useCallback(() => {
    Alert.alert('Kết thúc chuyến', 'Xác nhận đã hoàn thành chuyến?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Kết thúc',
        onPress: () => {
          void (async () => {
            try {
              await completeActiveTrip();
              await syncGpsRunning();
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không kết thúc được chuyến.'));
            }
          })();
        },
      },
    ]);
  }, [completeActiveTrip, syncGpsRunning]);

  const onCancelTrip = useCallback(() => {
    Alert.alert('Hủy chuyến', 'Hủy chuyến hiện tại?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy chuyến',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await cancelActiveTrip();
              await syncGpsRunning();
            } catch (e) {
              Alert.alert('Lỗi', getErrorMessage(e, 'Không hủy được chuyến.'));
            }
          })();
        },
      },
    ]);
  }, [cancelActiveTrip, syncGpsRunning]);

  if (!user || user.role !== 'driver') {
    return (
      <View style={[os.root, st.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={os.root}>
      <View style={[os.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={os.topBarLeft}>
          <MaterialIcons name="local-shipping" size={26} color={Brand.forest} />
          <Text style={os.topTitleStitch} numberOfLines={1}>
            Chuyến xe
          </Text>
        </View>
      </View>
      <View style={os.hairline} />

      <ScrollView
        style={os.flatListFlex}
        contentContainerStyle={[st.pad, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}>
        {!hydrated ? (
          <ActivityIndicator style={st.mt} />
        ) : (
          <>
            {lastError ? (
              <View style={st.errBox}>
                <Text style={st.errText}>{lastError}</Text>
                <Pressable onPress={() => Linking.openSettings()} style={st.linkBtn}>
                  <Text style={st.linkBtnText}>Mở Cài đặt</Text>
                </Pressable>
              </View>
            ) : null}

            {activeTrip ? (
              <View style={st.card}>
                <Text style={st.cardTitle}>Chuyến hiện tại</Text>
                <Text style={st.mono}>ID: {String(activeTrip.id)}</Text>
                <Text style={st.row}>Trạng thái: {activeTrip.status}</Text>
                {activeTrip.harvestAreaId != null ? (
                  <Text style={st.row}>Khu: {String(activeTrip.harvestAreaId)}</Text>
                ) : null}
                {activeTrip.weighingStationId != null ? (
                  <Text style={st.row}>Trạm: {String(activeTrip.weighingStationId)}</Text>
                ) : null}

                {activeTrip.status === 'planned' ? (
                  <Pressable
                    style={[st.primaryBtn, busy && st.disabled]}
                    disabled={busy}
                    onPress={() => {
                      void (async () => {
                        try {
                          await startPlannedActiveTrip();
                        } catch (e) {
                          Alert.alert('Lỗi', getErrorMessage(e, 'Không bắt đầu được.'));
                        }
                      })();
                    }}>
                    <Text style={st.primaryBtnText}>Xuất phát (start)</Text>
                  </Pressable>
                ) : null}

                {activeTrip.status === 'in_progress' ? (
                  <>
                    <View style={st.switchRow}>
                      <View style={st.switchLabelWrap}>
                        <Text style={st.switchLabel}>Theo dõi GPS</Text>
                        <Text style={st.switchSub}>
                          {gpsRunning
                            ? 'Đang gửi vị trí nền (nếu đã cấp quyền).'
                            : trackingDesired
                              ? 'Đang bật — chờ vị trí…'
                              : 'Tắt — không gửi vị trí.'}
                        </Text>
                      </View>
                      <Switch
                        value={trackingDesired}
                        onValueChange={(v) => {
                          void onToggleGps(v);
                        }}
                      />
                    </View>
                  </>
                ) : null}

                <View style={st.rowBtns}>
                  {activeTrip.status === 'in_progress' ? (
                    <Pressable
                      style={[st.outlineBtn, busy && st.disabled]}
                      disabled={busy}
                      onPress={onComplete}>
                      <Text style={st.outlineBtnText}>Kết thúc chuyến</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[st.dangerOutline, busy && st.disabled]}
                    disabled={busy}
                    onPress={onCancelTrip}>
                    <Text style={st.dangerText}>Hủy chuyến</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={st.card}>
                <Text style={st.cardTitle}>Tạo chuyến mới</Text>
                <Text style={st.hint}>
                  Chọn khu và trạm, sau đó bắt đầu chuyến (startNow). Mỗi tài xế chỉ một chuyến
                  in_progress.
                </Text>
                {listsLoading ? (
                  <ActivityIndicator style={st.mt} />
                ) : (
                  <>
                    {listsErr ? <Text style={st.warn}>{listsErr}</Text> : null}
                    <Pressable style={st.pickRow} onPress={() => setAreaModal(true)}>
                      <Text style={st.pickLabel}>{areaLabel}</Text>
                      <MaterialIcons name="arrow-drop-down" size={28} color={S.onSurfaceVariant} />
                    </Pressable>
                    <Pressable style={st.pickRow} onPress={() => setStationModal(true)}>
                      <Text style={st.pickLabel}>{stationLabel}</Text>
                      <MaterialIcons name="arrow-drop-down" size={28} color={S.onSurfaceVariant} />
                    </Pressable>
                    <Pressable
                      style={[st.primaryBtn, busy && st.disabled]}
                      disabled={busy}
                      onPress={() => {
                        void onCreateStart();
                      }}>
                      <Text style={st.primaryBtnText}>Bắt đầu chuyến</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={areaModal} animationType="slide" transparent>
        <Pressable style={st.modalBackdrop} onPress={() => setAreaModal(false)}>
          <Pressable style={st.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={st.modalTitle}>Khu khai thác</Text>
            <FlatList
              data={areas}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={st.modalItem}
                  onPress={() => {
                    setAreaId(String(item.id));
                    setAreaModal(false);
                  }}>
                  <Text style={st.modalItemText}>{item.name}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={stationModal} animationType="slide" transparent>
        <Pressable style={st.modalBackdrop} onPress={() => setStationModal(false)}>
          <Pressable style={st.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={st.modalTitle}>Trạm cân</Text>
            <FlatList
              data={stations}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={st.modalItem}
                  onPress={() => {
                    setStationId(String(item.id));
                    setStationModal(false);
                  }}>
                  <Text style={st.modalItemText}>{item.name}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { paddingHorizontal: 24, paddingTop: 20 },
  mt: { marginTop: 16 },
  errBox: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errText: { color: Brand.ink, fontSize: 14 },
  linkBtn: { marginTop: 8 },
  linkBtnText: { color: S.primary, fontWeight: '600' },
  card: {
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Brand.ink, marginBottom: 8 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }), fontSize: 12, color: S.onSurfaceVariant },
  row: { fontSize: 14, color: S.onSurfaceVariant, marginTop: 4 },
  hint: { fontSize: 14, color: S.onSurfaceVariant, marginBottom: 12, lineHeight: 20 },
  warn: { color: '#b71c1c', marginBottom: 8, fontSize: 13 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: Brand.canvas,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: S.outline,
  },
  pickLabel: { fontSize: 15, color: Brand.ink, flex: 1 },
  primaryBtn: {
    backgroundColor: S.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: Brand.surface, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  switchLabelWrap: { flex: 1 },
  switchLabel: { fontSize: 16, fontWeight: '500', color: Brand.ink },
  switchSub: { fontSize: 12, color: S.onSurfaceVariant, marginTop: 4 },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: S.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  outlineBtnText: { color: S.primary, fontWeight: '600' },
  dangerOutline: {
    borderWidth: 1,
    borderColor: '#c62828',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  dangerText: { color: '#c62828', fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0006',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Brand.canvas,
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', padding: 16, color: Brand.ink },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: S.outline },
  modalItemText: { fontSize: 16, color: Brand.ink },
});
