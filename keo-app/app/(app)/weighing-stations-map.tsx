import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapType, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { getErrorMessage } from '@/lib/api/errors';
import { listHarvestAreas } from '@/lib/api/harvest-areas';
import {
  harvestAreaPinColor,
  normalizeHarvestStatus,
  normalizeStationStatus,
  weighingStationPinColor,
} from '@/lib/map/pin-styles';
import { listWeighingStations } from '@/lib/api/weighing-stations';
import type { HarvestArea, WeighingStation } from '@/lib/types/ops';

const S = Brand.stitch;

const LIST_PAGE_LIMIT = 100;
const MAX_PAGES = 80;

type OpsMapLayer = Extract<MapType, 'standard' | 'satellite'>;

const FALLBACK_REGION: Region = {
  latitude: 16.0,
  longitude: 108.0,
  latitudeDelta: 14,
  longitudeDelta: 14,
};

function regionForCoordinates(coords: { latitude: number; longitude: number }[]): Region {
  if (coords.length === 0) return FALLBACK_REGION;
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;
  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: Math.min(latSpan * 1.35, 22),
    longitudeDelta: Math.min(lngSpan * 1.35, 22),
  };
}

type MapPinKind = 'station' | 'harvest';

type MapPinModel = {
  kind: MapPinKind;
  id: string | number;
  latitude: number;
  longitude: number;
  color: string;
  name: string;
};

function MapPinMarker({ color, icon }: { color: string; icon: 'scale' | 'park' }) {
  return (
    <View style={[pinMarkerStyles.ring, { borderColor: color }]}>
      <View style={pinMarkerStyles.inner}>
        <MaterialIcons name={icon} size={22} color={color} />
      </View>
    </View>
  );
}

const pinMarkerStyles = StyleSheet.create({
  ring: {
    borderWidth: 3,
    borderRadius: 22,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 4,
  },
  inner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});

const OpsMapBody = memo(function OpsMapBody({
  initialRegion,
  pins,
  tracksViewChanges,
  mapType,
  onPinPress,
}: {
  initialRegion: Region;
  pins: MapPinModel[];
  tracksViewChanges: boolean;
  mapType: OpsMapLayer;
  onPinPress: (pin: MapPinModel) => void;
}) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      showsUserLocation={true}
      showsMyLocationButton={true}
      rotateEnabled={true}
      pitchEnabled={true}
      mapType={mapType}>
      {pins.map((p) => (
        <Marker
          key={`${p.kind}-${String(p.id)}`}
          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={tracksViewChanges}
          onPress={() => onPinPress(p)}>
          <MapPinMarker color={p.color} icon={p.kind === 'station' ? 'scale' : 'park'} />
        </Marker>
      ))}
    </MapView>
  );
});

async function fetchAllWeighingStations(): Promise<
  | { ok: true; data: WeighingStation[] }
  | { ok: false; forbidden: true }
  | { ok: false; message: string }
> {
  const all: WeighingStation[] = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const res = await listWeighingStations({ page, limit: LIST_PAGE_LIMIT });
    if (!res.ok) {
      if (res.forbidden) return { ok: false, forbidden: true };
      return { ok: false, message: res.message };
    }
    all.push(...res.body.data);
    if (!res.body.hasNextPage) break;
    page += 1;
  }
  return { ok: true, data: all };
}

async function fetchAllHarvestAreas(): Promise<HarvestArea[]> {
  const all: HarvestArea[] = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const res = await listHarvestAreas({ page, limit: LIST_PAGE_LIMIT });
    all.push(...res.data);
    if (!res.hasNextPage) break;
    page += 1;
  }
  return all;
}

function withStationCoords(items: WeighingStation[]): WeighingStation[] {
  return items.filter(
    (s) =>
      s.latitude != null &&
      s.longitude != null &&
      Number.isFinite(Number(s.latitude)) &&
      Number.isFinite(Number(s.longitude)),
  );
}

function withHarvestCoords(items: HarvestArea[]): HarvestArea[] {
  return items.filter(
    (h) =>
      h.latitude != null &&
      h.longitude != null &&
      Number.isFinite(Number(h.latitude)) &&
      Number.isFinite(Number(h.longitude)),
  );
}

type WebRow =
  | { kind: 'station'; item: WeighingStation; color: string }
  | { kind: 'harvest'; item: HarvestArea; color: string };

export default function WeighingStationsMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stations, setStations] = useState<WeighingStation[]>([]);
  const [harvestAreas, setHarvestAreas] = useState<HarvestArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stationForbidden, setStationForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [harvestFetchFailed, setHarvestFetchFailed] = useState(false);
  const initialFetchDoneRef = useRef(false);
  const [pinRenderEpoch, setPinRenderEpoch] = useState(0);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [mapLayer, setMapLayer] = useState<OpsMapLayer>('standard');

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!initialFetchDoneRef.current) {
      setLoading(true);
    }
    setLoadError(null);
    setStationForbidden(false);
    setHarvestFetchFailed(false);

    const [sr, hr] = await Promise.all([
      fetchAllWeighingStations(),
      (async (): Promise<{ ok: true; data: HarvestArea[] } | { ok: false; message: string }> => {
        try {
          const data = await fetchAllHarvestAreas();
          return { ok: true, data };
        } catch (e) {
          return {
            ok: false,
            message: getErrorMessage(e, 'Không tải được khu khai thác'),
          };
        }
      })(),
    ]);

    if (sr.ok) {
      setStations(sr.data);
    } else if ('forbidden' in sr) {
      setStationForbidden(true);
      setStations([]);
    } else {
      setStations([]);
    }

    if (hr.ok) {
      setHarvestAreas(hr.data);
    } else {
      setHarvestAreas([]);
      setHarvestFetchFailed(true);
    }

    const stationFailed = !sr.ok && !('forbidden' in sr);
    const harvestFailed = !hr.ok;
    if (stationFailed && harvestFailed) {
      setLoadError(
        `${(sr as { message: string }).message} · ${(hr as { message: string }).message}`,
      );
    } else if (stationFailed) {
      setLoadError((sr as { message: string }).message);
    } else if (harvestFailed) {
      setLoadError((hr as { message: string }).message);
    } else {
      setLoadError(null);
    }
    if ((sr.ok && sr.data.length > 0) || (hr.ok && hr.data.length > 0)) {
      setLoadError(null);
    }

    initialFetchDoneRef.current = true;
    setLoading(false);
    setRefreshing(false);
    setPinRenderEpoch((n) => n + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  useEffect(() => {
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 700);
    return () => clearTimeout(t);
  }, [pinRenderEpoch]);

  const stationsOnMap = useMemo(() => withStationCoords(stations), [stations]);
  const harvestsOnMap = useMemo(() => withHarvestCoords(harvestAreas), [harvestAreas]);

  const initialRegion = useMemo(() => {
    const coords: { latitude: number; longitude: number }[] = [
      ...stationsOnMap.map((s) => ({
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      })),
      ...harvestsOnMap.map((h) => ({
        latitude: Number(h.latitude),
        longitude: Number(h.longitude),
      })),
    ];
    return regionForCoordinates(coords);
  }, [stationsOnMap, harvestsOnMap]);

  const pins = useMemo((): MapPinModel[] => {
    const stationPins: MapPinModel[] = stationsOnMap.map((s) => {
      const st = normalizeStationStatus(s.status);
      return {
        kind: 'station',
        id: s.id,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        color: weighingStationPinColor(st),
        name: s.name,
      };
    });
    const harvestPins: MapPinModel[] = harvestsOnMap.map((h) => {
      const st = normalizeHarvestStatus(h.status);
      return {
        kind: 'harvest',
        id: h.id,
        latitude: Number(h.latitude),
        longitude: Number(h.longitude),
        color: harvestAreaPinColor(st),
        name: h.name,
      };
    });
    return [...stationPins, ...harvestPins];
  }, [stationsOnMap, harvestsOnMap]);

  const onPinPress = useCallback(
    (pin: MapPinModel) => {
      if (pin.kind === 'station') {
        router.push(`/weighing-station/${String(pin.id)}`);
      } else {
        router.push(`/harvest-area/${String(pin.id)}`);
      }
    },
    [router],
  );

  const onRefresh = useCallback(() => {
    void load(true);
  }, [load]);

  const webRows = useMemo((): WebRow[] => {
    const rows: WebRow[] = [];
    for (const s of stationsOnMap) {
      rows.push({
        kind: 'station',
        item: s,
        color: weighingStationPinColor(normalizeStationStatus(s.status)),
      });
    }
    for (const h of harvestsOnMap) {
      rows.push({
        kind: 'harvest',
        item: h,
        color: harvestAreaPinColor(normalizeHarvestStatus(h.status)),
      });
    }
    return rows;
  }, [stationsOnMap, harvestsOnMap]);

  const hasAnyPins = pins.length > 0;
  const blockingError =
    loadError != null &&
    stations.length === 0 &&
    harvestAreas.length === 0 &&
    !stationForbidden;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.flex}>
        <View style={styles.webBanner}>
          <MaterialIcons name="map" size={40} color={S.primary} />
          <Text style={styles.webTitle}>Bản đồ vận hành</Text>
          <Text style={styles.webBody}>
            Trên web hiển thị danh sách điểm có GPS. Mở app iOS/Android để xem Google Maps đầy đủ.
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={S.primary} style={styles.webLoader} />
        ) : blockingError ? (
          <View style={styles.centeredWeb}>
            <Text style={styles.centerMsg}>{loadError}</Text>
            <Pressable onPress={() => void load(false)} style={styles.retry}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : stationForbidden && harvestFetchFailed ? (
          <Text style={styles.centerMsg}>Không tải được trạm (403) và khu khai thác.</Text>
        ) : (
          <FlatList
            data={webRows}
            keyExtractor={(row) => `${row.kind}-${String(row.item.id)}`}
            contentContainerStyle={styles.webList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              stationForbidden ? (
                <Text style={styles.webHint}>Danh sách trạm: không có quyền (403).</Text>
              ) : harvestFetchFailed ? (
                <Text style={styles.webHint}>Không tải được khu khai thác — chỉ hiển thị trạm (nếu có).</Text>
              ) : null
            }
            renderItem={({ item: row }) => (
              <Pressable
                style={[styles.webRow, { borderLeftColor: row.color, borderLeftWidth: 4 }]}
                onPress={() =>
                  row.kind === 'station'
                    ? router.push(`/weighing-station/${String(row.item.id)}`)
                    : router.push(`/harvest-area/${String(row.item.id)}`)
                }>
                <View style={styles.webRowHead}>
                  <MaterialIcons
                    name={row.kind === 'station' ? 'scale' : 'park'}
                    size={20}
                    color={row.color}
                  />
                  <Text style={styles.webRowKind}>
                    {row.kind === 'station' ? 'Trạm cân' : 'Khu khai thác'}
                  </Text>
                </View>
                <Text style={styles.webRowTitle}>{row.item.name}</Text>
                <Text style={styles.webRowSub}>
                  {row.item.latitude}, {row.item.longitude}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.centerMsg}>
                {stationForbidden && !harvestFetchFailed && harvestAreas.length === 0
                  ? 'Không có dữ liệu hiển thị.'
                  : 'Chưa có điểm nào có tọa độ GPS.'}
              </Text>
            }
          />
        )}
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={S.primary} />
        <Text style={styles.hint}>Đang tải bản đồ…</Text>
      </View>
    );
  }

  if (blockingError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centerMsg}>{loadError}</Text>
        <Pressable onPress={() => void load(false)} style={styles.retry}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (stationForbidden && harvestFetchFailed && !hasAnyPins) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="lock-outline" size={48} color={S.outline} />
        <Text style={styles.centerMsg}>Không có quyền xem trạm (403) và không tải được khu khai thác.</Text>
        <Pressable onPress={() => void load(false)} style={styles.retry}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <StatusBar style="dark" />
      {hasAnyPins ? (
        <OpsMapBody
          initialRegion={initialRegion}
          pins={pins}
          tracksViewChanges={tracksViewChanges}
          mapType={mapLayer}
          onPinPress={onPinPress}
        />
      ) : (
        <View style={[styles.emptyMapBg, StyleSheet.absoluteFill]} pointerEvents="none" />
      )}

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        style={[styles.backFab, { top: insets.top + 10 }]}>
        <MaterialIcons name="arrow-back" size={24} color={S.primary} />
      </Pressable>

      {!hasAnyPins ? (
        <View style={[styles.emptyOverlay, { paddingTop: insets.top + 56 }]}>
          <MaterialIcons name="place" size={40} color={S.onSurfaceVariant} />
          <Text style={styles.bannerEmptyText}>
            {stationForbidden
              ? 'Không có quyền xem trạm. '
              : stations.length === 0 && harvestAreas.length === 0
                ? 'Chưa có dữ liệu. '
                : ''}
            Chưa có điểm nào có tọa độ GPS trên bản đồ. Cập nhật vị trí tại chi tiết trạm hoặc khu khai thác.
          </Text>
        </View>
      ) : null}

      {(stationForbidden || harvestFetchFailed) && hasAnyPins ? (
        <View style={[styles.warnBanner, { top: insets.top + 56 }]}>
          {stationForbidden ? (
            <Text style={styles.warnText} numberOfLines={2}>
              Một số trạm không tải được (403).
            </Text>
          ) : null}
          {harvestFetchFailed ? (
            <Text style={styles.warnText} numberOfLines={2}>
              Không tải được khu khai thác — chỉ hiển thị trạm trên bản đồ.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.floatingBar, { bottom: insets.bottom + 16 }]}>
        <View style={styles.mapToolbar}>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [styles.fabChip, pressed && styles.fabChipPressed]}
            disabled={refreshing}>
            <MaterialIcons name="refresh" size={20} color={S.primary} />
            <Text style={styles.fabChipText} numberOfLines={2}>
              {refreshing ? 'Đang làm mới…' : 'Làm mới'}
            </Text>
          </Pressable>
          <View style={styles.mapLayerRow}>
            <Pressable
              onPress={() => setMapLayer('standard')}
              style={({ pressed }) => [
                styles.mapLayerChip,
                mapLayer === 'standard' && styles.mapLayerChipOn,
                pressed && styles.fabChipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Bản đồ đường"
              accessibilityState={{ selected: mapLayer === 'standard' }}>
              <MaterialIcons
                name="map"
                size={20}
                color={mapLayer === 'standard' ? '#fff' : S.primary}
              />
              <Text
                style={[
                  styles.mapLayerChipText,
                  mapLayer === 'standard' && styles.mapLayerChipTextOn,
                ]}
                numberOfLines={2}>
                Bản đồ đường
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMapLayer('satellite')}
              style={({ pressed }) => [
                styles.mapLayerChip,
                mapLayer === 'satellite' && styles.mapLayerChipOn,
                pressed && styles.fabChipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Ảnh vệ tinh"
              accessibilityState={{ selected: mapLayer === 'satellite' }}>
              <MaterialIcons
                name="satellite"
                size={20}
                color={mapLayer === 'satellite' ? '#fff' : S.primary}
              />
              <Text
                style={[
                  styles.mapLayerChipText,
                  mapLayer === 'satellite' && styles.mapLayerChipTextOn,
                ]}
                numberOfLines={2}>
                Ảnh vệ tinh
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <MaterialIcons name="scale" size={16} color={S.primary} />
            <Text style={styles.legendText}>Trạm cân</Text>
          </View>
          <View style={styles.legendRow}>
            <MaterialIcons name="park" size={16} color={Brand.forest} />
            <Text style={styles.legendText}>Khu khai thác</Text>
          </View>
          <Text style={styles.legendCaption}>Màu viền theo trạng thái</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#e8ebe9',
  },
  flex: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  emptyMapBg: {
    backgroundColor: Brand.canvas,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.canvas,
  },
  centeredWeb: {
    padding: 24,
    alignItems: 'center',
  },
  hint: {
    marginTop: 12,
    color: S.onSurfaceVariant,
    fontSize: 15,
  },
  centerMsg: {
    marginTop: 12,
    textAlign: 'center',
    color: S.onSurfaceVariant,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  retry: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: S.primary,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  backFab: {
    position: 'absolute',
    left: 12,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: S.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(251,249,248,0.92)',
  },
  bannerEmptyText: {
    marginTop: 12,
    textAlign: 'center',
    color: S.onSurfaceVariant,
    fontSize: 15,
    lineHeight: 22,
  },
  warnBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,230,0.96)',
    borderWidth: 1,
    borderColor: S.tertiaryFixed,
  },
  warnText: {
    fontSize: 13,
    color: S.onTertiaryFixed,
    lineHeight: 18,
  },
  floatingBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  mapToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 10,
  },
  mapLayerRow: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 200,
    gap: 8,
  },
  mapLayerChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: S.outlineVariant,
  },
  mapLayerChipOn: {
    backgroundColor: S.primary,
    borderColor: S.primary,
  },
  mapLayerChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: S.primary,
    textAlign: 'center',
    lineHeight: 18,
  },
  mapLayerChipTextOn: {
    color: '#fff',
  },
  fabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: S.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 3,
    flexShrink: 0,
  },
  fabChipPressed: {
    opacity: 0.88,
  },
  fabChipText: {
    color: S.primary,
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'center',
    lineHeight: 20,
  },
  legend: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: S.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '600',
    color: S.onSurfaceVariant,
  },
  legendCaption: {
    marginTop: 4,
    fontSize: 11,
    color: S.outline,
  },
  webBanner: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
  },
  webTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
    color: S.primary,
  },
  webBody: {
    marginTop: 8,
    textAlign: 'center',
    color: S.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  webHint: {
    marginBottom: 12,
    fontSize: 13,
    color: S.tertiary,
    paddingHorizontal: 4,
  },
  webLoader: {
    marginTop: 24,
  },
  webList: {
    padding: 16,
    paddingBottom: 32,
  },
  webRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: S.surfaceContainerLow,
    borderWidth: 1,
    borderColor: S.outlineVariant,
  },
  webRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  webRowKind: {
    fontSize: 12,
    fontWeight: '700',
    color: S.outline,
    textTransform: 'uppercase',
  },
  webRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: S.primary,
  },
  webRowSub: {
    marginTop: 4,
    fontSize: 13,
    color: S.outline,
  },
});
