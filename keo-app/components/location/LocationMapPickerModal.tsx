import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { PermissionStatus } from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapType, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';

const S = Brand.stitch;

type PickerMapLayer = Extract<MapType, 'standard' | 'satellite'>;

const DEFAULT_CENTER = { latitude: 16.0, longitude: 108.0 };
const DEFAULT_DELTA = { latitudeDelta: 0.12, longitudeDelta: 0.12 };

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type LocationMapPickerModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  onConfirm: (coords: LatLng) => void;
  initialCoordinate?: LatLng | null;
  title?: string;
};

function parseInitial(initial: LatLng | null | undefined): LatLng {
  if (
    initial != null &&
    Number.isFinite(initial.latitude) &&
    Number.isFinite(initial.longitude)
  ) {
    return { latitude: initial.latitude, longitude: initial.longitude };
  }
  return { ...DEFAULT_CENTER };
}

export function LocationMapPickerModal({
  visible,
  onRequestClose,
  onConfirm,
  initialCoordinate,
  title = 'Chọn vị trí trên bản đồ',
}: LocationMapPickerModalProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [draft, setDraft] = useState<LatLng>(() => parseInitial(initialCoordinate));
  const [mapNonce, setMapNonce] = useState(0);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [mapLayer, setMapLayer] = useState<PickerMapLayer>('standard');

  const initialRegion: Region = {
    latitude: draft.latitude,
    longitude: draft.longitude,
    ...DEFAULT_DELTA,
  };

  useLayoutEffect(() => {
    if (!visible) return;
    const next = parseInitial(initialCoordinate);
    setDraft(next);
    setMapNonce((n) => n + 1);
  }, [visible, initialCoordinate]);

  useEffect(() => {
    if (!visible) return;
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 700);
    return () => clearTimeout(t);
  }, [visible, mapNonce]);

  const onMapPress = useCallback((e: { nativeEvent: { coordinate: LatLng } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDraft({ latitude, longitude });
  }, []);

  const onDragEnd = useCallback((e: { nativeEvent: { coordinate: LatLng } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDraft({ latitude, longitude });
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== PermissionStatus.GRANTED) {
        Alert.alert(
          'Không có quyền vị trí',
          'Bật quyền vị trí trong Cài đặt hoặc chọn điểm trực tiếp trên bản đồ.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setDraft({ latitude, longitude });
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: DEFAULT_DELTA.latitudeDelta,
          longitudeDelta: DEFAULT_DELTA.longitudeDelta,
        },
        280,
      );
    } catch {
      Alert.alert('Lỗi', 'Không lấy được vị trí hiện tại. Thử lại hoặc chạm bản đồ.');
    } finally {
      setGpsBusy(false);
    }
  }, []);

  const confirm = useCallback(() => {
    onConfirm(draft);
    onRequestClose();
  }, [draft, onConfirm, onRequestClose]);

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onRequestClose}>
        <View style={styles.webBackdrop}>
          <View style={[styles.webCard, { marginTop: insets.top + 24 }]}>
            <Text style={styles.webTitle}>{title}</Text>
            <Text style={styles.webBody}>
              Chọn vị trí trên bản đồ chỉ khả dụng trên ứng dụng iOS/Android. Trên web, nhập tọa độ trực tiếp ở form.
            </Text>
            <Pressable onPress={onRequestClose} style={styles.webBtn}>
              <Text style={styles.webBtnText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onRequestClose}>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <View style={[styles.topBarWrap, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topBarRow}>
            <Pressable onPress={onRequestClose} hitSlop={12} style={styles.topBtn}>
              <Text style={styles.topBtnText}>Huỷ</Text>
            </Pressable>
            <Text style={styles.topTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.topBarSpacer} />
          </View>
          <View style={styles.topMapToolbar}>
            <Pressable
              onPress={() => setMapLayer('standard')}
              style={[
                styles.topMapTypeBtn,
                mapLayer === 'standard' && styles.topMapTypeBtnOn,
              ]}
              accessibilityLabel="Bản đồ đường"
              accessibilityRole="button"
              accessibilityState={{ selected: mapLayer === 'standard' }}>
              <MaterialIcons
                name="map"
                size={22}
                color={mapLayer === 'standard' ? '#fff' : S.primary}
              />
              <Text
                style={[
                  styles.topMapTypeBtnText,
                  mapLayer === 'standard' && styles.topMapTypeBtnTextOn,
                ]}
                numberOfLines={2}>
                Bản đồ đường
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMapLayer('satellite')}
              style={[
                styles.topMapTypeBtn,
                mapLayer === 'satellite' && styles.topMapTypeBtnOn,
              ]}
              accessibilityLabel="Ảnh vệ tinh"
              accessibilityRole="button"
              accessibilityState={{ selected: mapLayer === 'satellite' }}>
              <MaterialIcons
                name="satellite"
                size={22}
                color={mapLayer === 'satellite' ? '#fff' : S.primary}
              />
              <Text
                style={[
                  styles.topMapTypeBtnText,
                  mapLayer === 'satellite' && styles.topMapTypeBtnTextOn,
                ]}
                numberOfLines={2}>
                Ảnh vệ tinh
              </Text>
            </Pressable>
          </View>
        </View>

        <MapView
          key={mapNonce}
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          mapType={mapLayer}
          onPress={onMapPress}
          rotateEnabled={true}
          pitchEnabled={true}
          showsUserLocation={true}
          showsMyLocationButton={true}>
          <Marker
            coordinate={draft}
            draggable
            onDragEnd={onDragEnd}
            tracksViewChanges={tracksViewChanges}
            anchor={{ x: 0.5, y: 1 }}
          />
        </MapView>

        <Text style={styles.hint} pointerEvents="none">
          Chạm bản đồ hoặc kéo ghim để đặt vị trí
        </Text>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={() => void handleUseCurrentLocation()}
            disabled={gpsBusy}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
            {gpsBusy ? (
              <ActivityIndicator size="small" color={S.primary} />
            ) : (
              <>
                <MaterialIcons name="my-location" size={20} color={S.primary} />
                <Text style={styles.secondaryBtnText} numberOfLines={2}>
                  Vị trí hiện tại
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={confirm}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Text style={styles.primaryBtnText} numberOfLines={2}>
              Xác nhận vị trí
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
  topBarWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  topBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 52,
  },
  topBtnText: {
    fontSize: 16,
    color: S.onSurfaceVariant,
    fontWeight: '600',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: S.primary,
    paddingHorizontal: 4,
  },
  topBarSpacer: {
    minWidth: 52,
  },
  topMapToolbar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  topMapTypeBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: S.outlineVariant,
    backgroundColor: S.surfaceContainerLow,
  },
  topMapTypeBtnOn: {
    backgroundColor: S.primary,
    borderColor: S.primary,
  },
  topMapTypeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: S.primary,
    textAlign: 'center',
    lineHeight: 18,
  },
  topMapTypeBtnTextOn: {
    color: '#fff',
  },
  hint: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 148,
    zIndex: 5,
    textAlign: 'center',
    fontSize: 13,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.outlineVariant,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: S.outlineVariant,
    backgroundColor: S.surfaceContainerLow,
    minHeight: 52,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: S.primary,
    textAlign: 'center',
    flexShrink: 1,
    lineHeight: 20,
  },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: S.primary,
    minHeight: 52,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.88,
  },
  webBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
  },
  webCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: Brand.canvas,
    borderWidth: 1,
    borderColor: S.outlineVariant,
  },
  webTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: S.primary,
    marginBottom: 10,
  },
  webBody: {
    fontSize: 15,
    lineHeight: 22,
    color: S.onSurfaceVariant,
    marginBottom: 18,
  },
  webBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: S.primary,
  },
  webBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
