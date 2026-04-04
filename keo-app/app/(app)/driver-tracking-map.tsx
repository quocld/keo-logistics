import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, type MapType, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DriverTrackingMapMarker } from '@/components/map/driver-tracking-map-marker';
import { AvatarResolvedImage } from '@/components/profile/AvatarResolvedImage';
import { Brand } from '@/constants/brand';
import { resolveDriverLocationAvatar } from '@/lib/avatar/resolve-from-location';
import type { ResolvedAvatarDisplay } from '@/lib/avatar/resolve-display';
import { listHarvestAreas } from '@/lib/api/harvest-areas';
import { listWeighingStations } from '@/lib/api/weighing-stations';
import {
  driverPinColor,
  getDriverFreshness,
  harvestAreaPinColor,
  normalizeHarvestStatus,
  normalizeStationStatus,
  weighingStationPinColor,
  type DriverFreshness,
} from '@/lib/map/pin-styles';
import type { HarvestArea, WeighingStation } from '@/lib/types/ops';
import {
  useDriverLocationsPolling,
  type DriverLocationEntry,
} from '@/hooks/use-driver-locations-polling';

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

// ---------------------------------------------------------------------------
// Pin marker components
// ---------------------------------------------------------------------------

function ContextPinMarker({ color, icon }: { color: string; icon: 'scale' | 'park' }) {
  return (
    <View style={[pinStyles.ctxRing, { borderColor: color }]}>
      <View style={pinStyles.ctxInner}>
        <MaterialIcons name={icon} size={14} color={color} />
      </View>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  ctxRing: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
    opacity: 0.7,
  },
  ctxInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});

// ---------------------------------------------------------------------------
// Callout helpers
// ---------------------------------------------------------------------------

function driverDisplayName(loc: DriverLocationEntry): string {
  const parts: string[] = [];
  if (loc.firstName) parts.push(loc.firstName);
  if (loc.lastName) parts.push(loc.lastName);
  if (parts.length > 0) return parts.join(' ');
  if (loc.email) return loc.email;
  const id = loc.driverId ?? loc.driverUserId ?? loc.userId;
  return id != null ? `Tài xế #${id}` : 'Tài xế';
}

function freshnessLabel(f: DriverFreshness): string {
  switch (f) {
    case 'active':
      return 'Đang hoạt động';
    case 'stale':
      return 'Mất tín hiệu';
    case 'offline':
      return 'Ngoại tuyến';
  }
}

function relativeTime(timestamp: string | undefined | null): string {
  if (!timestamp) return '—';
  const diff = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(diff) || diff < 0) return '—';
  if (diff < 60_000) return 'Vừa xong';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h${mins % 60}m trước`;
}

// ---------------------------------------------------------------------------
// Pulsing "Live" indicator
// ---------------------------------------------------------------------------

function LiveBadge() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={badgeStyles.container}>
      <Animated.View style={[badgeStyles.dot, { opacity: pulse }]} />
      <Text style={badgeStyles.text}>Live</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// Context data fetching (stations + harvest areas, one-shot)
// ---------------------------------------------------------------------------

async function fetchAllWeighingStations(): Promise<WeighingStation[]> {
  const all: WeighingStation[] = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const res = await listWeighingStations({ page, limit: LIST_PAGE_LIMIT });
    if (!res.ok) break;
    all.push(...res.body.data);
    if (!res.body.hasNextPage) break;
    page += 1;
  }
  return all;
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

function withCoords<T extends { latitude?: number | null; longitude?: number | null }>(items: T[]): T[] {
  return items.filter(
    (i) =>
      i.latitude != null &&
      i.longitude != null &&
      Number.isFinite(Number(i.latitude)) &&
      Number.isFinite(Number(i.longitude)),
  );
}

// ---------------------------------------------------------------------------
// Map body (memoised)
// ---------------------------------------------------------------------------

type DriverPin = {
  kind: 'driver';
  id: string;
  loc: DriverLocationEntry;
  freshness: DriverFreshness;
  color: string;
  name: string;
  avatarDisplay: ResolvedAvatarDisplay;
};

type ContextPin = {
  kind: 'station' | 'harvest';
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  name: string;
};

const TrackingMapBody = memo(function TrackingMapBody({
  initialRegion,
  driverPins,
  contextPins,
  tracksViewChanges,
  mapType,
}: {
  initialRegion: Region;
  driverPins: DriverPin[];
  contextPins: ContextPin[];
  tracksViewChanges: boolean;
  mapType: OpsMapLayer;
}) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton
      rotateEnabled
      pitchEnabled
      mapType={mapType}>
      {contextPins.map((p) => (
        <Marker
          key={`ctx-${p.kind}-${p.id}`}
          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}>
          <ContextPinMarker color={p.color} icon={p.kind === 'station' ? 'scale' : 'park'} />
        </Marker>
      ))}
      {driverPins.map((p) => (
        <Marker
          key={`drv-${p.id}`}
          coordinate={{ latitude: p.loc.latitude, longitude: p.loc.longitude }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={tracksViewChanges}>
          <DriverTrackingMapMarker
            borderColor={p.color}
            freshness={p.freshness}
            avatarDisplay={p.avatarDisplay}
          />
          <Callout tooltip={false}>
            <View style={calloutStyles.container}>
              <View style={calloutStyles.calloutRow}>
                <View style={calloutStyles.calloutAvatarWrap}>
                  <AvatarResolvedImage display={p.avatarDisplay} style={calloutStyles.calloutAvatar} />
                </View>
                <View style={calloutStyles.calloutTextCol}>
                  <Text style={calloutStyles.name}>{p.name}</Text>
                  <Text style={calloutStyles.detail}>
                    {freshnessLabel(p.freshness)} · {relativeTime(p.loc.timestamp)}
                  </Text>
                  {p.loc.speed != null && p.loc.speed > 0 ? (
                    <Text style={calloutStyles.detail}>
                      {(p.loc.speed * 3.6).toFixed(0)} km/h
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
});

const calloutStyles = StyleSheet.create({
  container: { minWidth: 200, maxWidth: 280, padding: 10 },
  calloutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  calloutAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#e8ebe9',
    borderWidth: 2,
    borderColor: `${Brand.forest}33`,
  },
  calloutAvatar: { width: 44, height: 44, borderRadius: 22 },
  calloutTextCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: '#1B1C1C', marginBottom: 4 },
  detail: { fontSize: 12, color: '#5C6B62', lineHeight: 17 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function DriverTrackingMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locations, loading: driverLoading, error, refresh } = useDriverLocationsPolling(5_000);

  const [stations, setStations] = useState<WeighingStation[]>([]);
  const [harvestAreas, setHarvestAreas] = useState<HarvestArea[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [mapLayer, setMapLayer] = useState<OpsMapLayer>('standard');
  const [pinRenderEpoch, setPinRenderEpoch] = useState(0);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const initialRegionSetRef = useRef(false);

  // One-shot load of context layers
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ws, ha] = await Promise.all([fetchAllWeighingStations(), fetchAllHarvestAreas()]);
        if (cancelled) return;
        setStations(ws);
        setHarvestAreas(ha);
      } catch {
        // context is optional — silently ignore
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Briefly enable tracksViewChanges when driver data changes so pins move
  useEffect(() => {
    setPinRenderEpoch((n) => n + 1);
  }, [locations]);

  useEffect(() => {
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 600);
    return () => clearTimeout(t);
  }, [pinRenderEpoch]);

  // Driver pins
  const driverPins = useMemo((): DriverPin[] => {
    return locations.map((loc) => {
      const freshness = getDriverFreshness(loc.timestamp);
      const id = String(loc.driverId ?? loc.driverUserId ?? loc.userId ?? loc.latitude);
      return {
        kind: 'driver',
        id,
        loc,
        freshness,
        color: driverPinColor(freshness),
        name: driverDisplayName(loc),
        avatarDisplay: resolveDriverLocationAvatar(loc),
      };
    });
  }, [locations]);

  // Context pins
  const contextPins = useMemo((): ContextPin[] => {
    const stationPins: ContextPin[] = withCoords(stations).map((s) => ({
      kind: 'station',
      id: String(s.id),
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      color: weighingStationPinColor(normalizeStationStatus(s.status)),
      name: s.name,
    }));
    const harvestPins: ContextPin[] = withCoords(harvestAreas).map((h) => ({
      kind: 'harvest',
      id: String(h.id),
      latitude: Number(h.latitude),
      longitude: Number(h.longitude),
      color: harvestAreaPinColor(normalizeHarvestStatus(h.status)),
      name: h.name,
    }));
    return [...stationPins, ...harvestPins];
  }, [stations, harvestAreas]);

  // Region: fit all driver pins (prefer drivers), fall back to context
  const initialRegion = useMemo(() => {
    if (initialRegionSetRef.current) return FALLBACK_REGION;
    const driverCoords = driverPins.map((p) => ({
      latitude: p.loc.latitude,
      longitude: p.loc.longitude,
    }));
    const ctxCoords = contextPins.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
    const coords = driverCoords.length > 0 ? driverCoords : ctxCoords;
    const r = regionForCoordinates(coords);
    if (coords.length > 0) initialRegionSetRef.current = true;
    return r;
  }, [driverPins, contextPins]);

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const isLoading = driverLoading && contextLoading;

  // Counts for legend
  const activeCount = driverPins.filter((p) => p.freshness === 'active').length;
  const staleCount = driverPins.filter((p) => p.freshness === 'stale').length;
  const offlineCount = driverPins.filter((p) => p.freshness === 'offline').length;

  // Web fallback
  if (Platform.OS === 'web') {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="map" size={40} color={S.primary} />
        <Text style={styles.centerMsg}>
          Theo dõi tài xế chỉ khả dụng trên iOS / Android.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={S.primary} />
        <Text style={styles.hint}>Đang tải vị trí tài xế…</Text>
      </View>
    );
  }

  if (error && driverPins.length === 0) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="wifi-off" size={48} color={S.outline} />
        <Text style={styles.centerMsg}>{error}</Text>
        <Pressable onPress={onRefresh} style={styles.retry}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <StatusBar style="dark" />

      {driverPins.length > 0 || contextPins.length > 0 ? (
        <TrackingMapBody
          initialRegion={initialRegion}
          driverPins={driverPins}
          contextPins={contextPins}
          tracksViewChanges={tracksViewChanges}
          mapType={mapLayer}
        />
      ) : (
        <View style={[styles.emptyMapBg, StyleSheet.absoluteFill]} pointerEvents="none" />
      )}

      {/* Back FAB */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        style={[styles.backFab, { top: insets.top + 10 }]}>
        <MaterialIcons name="arrow-back" size={24} color={S.primary} />
      </Pressable>

      {/* Live badge */}
      <View style={[styles.liveBadgeWrap, { top: insets.top + 14 }]}>
        <LiveBadge />
      </View>

      {/* Empty state overlay */}
      {driverPins.length === 0 && contextPins.length === 0 ? (
        <View style={[styles.emptyOverlay, { paddingTop: insets.top + 56 }]}>
          <MaterialIcons name="gps-fixed" size={40} color={S.onSurfaceVariant} />
          <Text style={styles.bannerEmptyText}>
            Chưa có tài xế nào cập nhật vị trí. Khi tài xế bật theo dõi GPS, pin sẽ hiện trên bản đồ.
          </Text>
        </View>
      ) : null}

      {/* Error banner (non-blocking) */}
      {error && driverPins.length > 0 ? (
        <View style={[styles.warnBanner, { top: insets.top + 56 }]}>
          <Text style={styles.warnText} numberOfLines={2}>
            Lỗi cập nhật vị trí: {error}
          </Text>
        </View>
      ) : null}

      {/* Bottom toolbar */}
      <View style={[styles.floatingBar, { bottom: insets.bottom + 16 }]}>
        <View style={styles.mapToolbar}>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [styles.fabChip, pressed && styles.fabChipPressed]}
            disabled={driverLoading}>
            <MaterialIcons name="refresh" size={20} color={S.primary} />
            <Text style={styles.fabChipText}>
              {driverLoading ? 'Đang tải…' : 'Làm mới'}
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
              <MaterialIcons name="map" size={20} color={mapLayer === 'standard' ? '#fff' : S.primary} />
              <Text
                style={[styles.mapLayerChipText, mapLayer === 'standard' && styles.mapLayerChipTextOn]}
                numberOfLines={2}>
                Bản đồ
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
              <MaterialIcons name="satellite" size={20} color={mapLayer === 'satellite' ? '#fff' : S.primary} />
              <Text
                style={[styles.mapLayerChipText, mapLayer === 'satellite' && styles.mapLayerChipTextOn]}
                numberOfLines={2}>
                Vệ tinh
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <MaterialIcons name="gps-fixed" size={16} color="#006d42" />
            <Text style={styles.legendText}>Tài xế ({activeCount} hoạt động</Text>
            {staleCount > 0 ? <Text style={styles.legendText}>, {staleCount} mất tín hiệu</Text> : null}
            {offlineCount > 0 ? <Text style={styles.legendText}>, {offlineCount} offline</Text> : null}
            <Text style={styles.legendText}>)</Text>
          </View>
          {contextPins.length > 0 ? (
            <>
              <View style={styles.legendRow}>
                <MaterialIcons name="scale" size={14} color={S.primary} />
                <Text style={styles.legendCaption}>Trạm cân</Text>
                <MaterialIcons name="park" size={14} color={Brand.forest} style={{ marginLeft: 10 }} />
                <Text style={styles.legendCaption}>Khu khai thác</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#e8ebe9' },
  emptyMapBg: { backgroundColor: Brand.canvas },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.canvas,
  },
  hint: { marginTop: 12, color: S.onSurfaceVariant, fontSize: 15 },
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
  retryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
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
  liveBadgeWrap: {
    position: 'absolute',
    right: 12,
    zIndex: 20,
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
  warnText: { fontSize: 13, color: S.onTertiaryFixed, lineHeight: 18 },
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
  mapLayerChipOn: { backgroundColor: S.primary, borderColor: S.primary },
  mapLayerChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: S.primary,
    textAlign: 'center',
    lineHeight: 18,
  },
  mapLayerChipTextOn: { color: '#fff' },
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
  fabChipPressed: { opacity: 0.88 },
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
    paddingVertical: 10,
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
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  legendText: { fontSize: 13, fontWeight: '600', color: S.onSurfaceVariant },
  legendCaption: { fontSize: 12, color: S.outline, marginLeft: 4 },
});
