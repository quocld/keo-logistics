import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormFieldLabel, FormSectionLabel } from '@/components/forms/FormFieldLabel';
import { stitchHarvestFormStyles as styles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { uploadOpsFile } from '@/lib/api/files';
import { listHarvestAreas } from '@/lib/api/harvest-areas';
import { createReceipt } from '@/lib/api/receipts';
import { listWeighingStations } from '@/lib/api/weighing-stations';
import type { HarvestArea, ReceiptCreatePayload, WeighingStation } from '@/lib/types/ops';

const S = Brand.stitch;
const isNative = Platform.OS !== 'web';

type PickedImage = { uri: string; name: string; mime: string };

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function FieldIconInput({
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldIconRow}>
      <MaterialIcons name={icon} size={20} color={`${S.outline}99`} style={styles.fieldIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={`${S.outline}80`}
        keyboardType={keyboardType ?? 'default'}
        style={[styles.fieldIconInput, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        multiline={multiline}
      />
    </View>
  );
}

function parseImageUrls(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNumber(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export default function ReceiptFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [areas, setAreas] = useState<HarvestArea[]>([]);
  const [stations, setStations] = useState<WeighingStation[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsErr, setListsErr] = useState<string | null>(null);

  const [areaId, setAreaId] = useState<string>('');
  const [stationId, setStationId] = useState<string>('');
  const [tripId, setTripId] = useState('');
  const [weight, setWeight] = useState('');
  const [amount, setAmount] = useState('');
  const [billCode, setBillCode] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrlsText, setImageUrlsText] = useState('');
  const [picked, setPicked] = useState<PickedImage[]>([]);
  const [saving, setSaving] = useState(false);

  const [areaModal, setAreaModal] = useState(false);
  const [stationModal, setStationModal] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'owner') {
      Alert.alert('Không khả dụng', 'Chỉ tài khoản chủ vườn (owner) dùng form tạo phiếu này.');
      router.back();
    }
  }, [user, router]);

  const loadLists = useCallback(async () => {
    setListsErr(null);
    setListsLoading(true);
    try {
      const [ha, ws] = await Promise.all([
        listHarvestAreas({ page: 1, limit: 200 }),
        listWeighingStations({ page: 1, limit: 200 }),
      ]);
      setAreas(ha.data);
      if (ws.ok) {
        setStations(ws.body.data);
      } else if (ws.forbidden) {
        setStations([]);
        setListsErr('Không tải được danh sách trạm (403). Vẫn có thể tạo phiếu nếu có tripId.');
      } else {
        setStations([]);
        setListsErr(ws.message);
      }
    } catch (e) {
      setListsErr(e instanceof Error ? e.message : 'Không tải danh sách');
      setAreas([]);
      setStations([]);
    } finally {
      setListsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const areaLabel = useCallback(() => {
    const a = areas.find((x) => String(x.id) === areaId);
    return a ? `${a.name}` : 'Chọn khu khai thác';
  }, [areas, areaId]);

  const stationLabel = useCallback(() => {
    const s = stations.find((x) => String(x.id) === stationId);
    return s ? `${s.name}` : 'Chọn trạm cân';
  }, [stations, stationId]);

  const pickImages = useCallback(async () => {
    if (!isNative) {
      Alert.alert('Web', 'Trên web hãy dán URL ảnh vào ô bên dưới (imageUrls).');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh để đính kèm bill.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 8,
      quality: 0.85,
    });
    if (res.canceled) return;
    const next: PickedImage[] = res.assets.map((a, i) => ({
      uri: a.uri,
      name: a.fileName ?? `receipt-${Date.now()}-${i}.jpg`,
      mime: a.mimeType ?? 'image/jpeg',
    }));
    setPicked((prev) => [...prev, ...next]);
  }, []);

  const removePicked = useCallback((uri: string) => {
    setPicked((prev) => prev.filter((p) => p.uri !== uri));
  }, []);

  const onSubmit = useCallback(async () => {
    if (!user || user.role !== 'owner') return;

    if (!areaId) {
      Alert.alert('Thiếu dữ liệu', 'Chọn khu khai thác.');
      return;
    }
    const w = parseNumber(weight);
    if (w == null || w <= 0) {
      Alert.alert('Thiếu dữ liệu', 'Nhập khối lượng (tấn) hợp lệ.');
      return;
    }
    const amt = parseNumber(amount);
    if (amt == null || amt < 0) {
      Alert.alert('Thiếu dữ liệu', 'Nhập số tiền (VND) hợp lệ.');
      return;
    }

    const urls = parseImageUrls(imageUrlsText);
    const hasTrip = tripId.trim().length > 0;
    if (!hasTrip && !stationId) {
      Alert.alert('Thiếu dữ liệu', 'Chọn trạm cân hoặc nhập tripId (chuyến đang chạy) theo Postman.');
      return;
    }
    if (!picked.length && !urls.length) {
      Alert.alert(
        'Ảnh bill',
        'API bắt buộc ít nhất một ảnh: thêm ảnh từ thư viện hoặc nhập imageUrls (URL công khai).',
      );
      return;
    }

    setSaving(true);
    try {
      const imageFileIds: string[] = [];
      for (const p of picked) {
        const id = await uploadOpsFile({ uri: p.uri, name: p.name, mimeType: p.mime });
        imageFileIds.push(id);
      }

      const body: ReceiptCreatePayload = {
        harvestAreaId: areaId,
        weight: w,
        amount: amt,
        receiptDate: new Date().toISOString(),
      };
      if (stationId) body.weighingStationId = stationId;
      if (hasTrip) body.tripId = tripId.trim();
      const bc = billCode.trim();
      if (bc) body.billCode = bc;
      const n = notes.trim();
      if (n) body.notes = n;
      if (imageFileIds.length) body.imageFileIds = imageFileIds;
      if (urls.length) body.imageUrls = urls;

      await createReceipt(body);
      Alert.alert('Đã tạo', 'Phiếu đã gửi lên server.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tạo được phiếu');
    } finally {
      setSaving(false);
    }
  }, [user, areaId, stationId, tripId, weight, amount, billCode, notes, imageUrlsText, picked, router]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Brand.ink} />
          </Pressable>
          <MaterialIcons name="receipt-long" size={22} color={Brand.forest} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Tạo phiếu cân
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.helpBtn}
            hitSlop={8}
            onPress={() =>
              Alert.alert(
                'POST /receipts',
                'Theo Postman: harvestAreaId, weight, amount, receiptDate; ít nhất imageUrls hoặc imageFileIds (sau POST /files/upload). tripId tùy chọn — khi có trip in_progress có thể bỏ weighingStationId.',
              )
            }>
            <MaterialIcons name="help-outline" size={20} color={Brand.ink} />
            <Text style={styles.helpBtnText}>Hỗ trợ</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.headerHairline} />

      {listsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={S.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {listsErr ? (
            <Text style={localStyles.warn}>{listsErr}</Text>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Khu & trạm</Text>
            <FormFieldLabel required>Khu khai thác</FormFieldLabel>
            <Pressable onPress={() => setAreaModal(true)} style={localStyles.selectBtn}>
              <Text style={localStyles.selectBtnText} numberOfLines={2}>
                {areaLabel()}
              </Text>
              <MaterialIcons name="expand-more" size={22} color={S.primary} />
            </Pressable>

            <FormFieldLabel style={{ marginTop: 16 }}>Trạm cân</FormFieldLabel>
            <Text style={styles.fieldApiHint}>
              Bắt buộc nếu không gửi <Text style={styles.fieldApiMono}>tripId</Text> (chuyến in_progress).
            </Text>
            <Pressable onPress={() => setStationModal(true)} style={localStyles.selectBtn}>
              <Text style={localStyles.selectBtnText} numberOfLines={2}>
                {stationLabel()}
              </Text>
              <MaterialIcons name="expand-more" size={22} color={S.primary} />
            </Pressable>

            <FormFieldLabel style={{ marginTop: 16 }}>Trip ID (tùy chọn)</FormFieldLabel>
            <FieldIconInput
              icon="local-shipping"
              value={tripId}
              onChangeText={setTripId}
              placeholder="UUID trip đang chạy — có thể bỏ trạm"
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Số liệu phiếu</Text>
            <FormFieldLabel required>Khối lượng (tấn)</FormFieldLabel>
            <FieldIconInput
              icon="scale"
              value={weight}
              onChangeText={setWeight}
              placeholder="12.5"
              keyboardType="decimal-pad"
            />
            <FormFieldLabel style={{ marginTop: 16 }} required>
              Số tiền (VND)
            </FormFieldLabel>
            <FieldIconInput
              icon="payments"
              value={amount}
              onChangeText={setAmount}
              placeholder="15000000"
              keyboardType="number-pad"
            />
            <FormFieldLabel>Mã bill</FormFieldLabel>
            <FieldIconInput
              icon="confirmation-number"
              value={billCode}
              onChangeText={setBillCode}
              placeholder="BILL-2026-0001"
            />
            <FormFieldLabel>Ghi chú</FormFieldLabel>
            <FieldIconInput
              icon="notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Ghi chú tùy chọn"
              multiline
            />
          </View>

          <View style={styles.sectionCard}>
            <FormSectionLabel required>Ảnh bill</FormSectionLabel>
            <Text style={styles.fieldApiHint}>
              Postman: ít nhất một trong <Text style={styles.fieldApiMono}>imageUrls</Text>,{' '}
              <Text style={styles.fieldApiMono}>imageFileIds</Text>.
            </Text>
            {isNative ? (
              <Pressable onPress={() => void pickImages()} style={localStyles.pickBtn}>
                <MaterialIcons name="add-photo-alternate" size={22} color={S.primary} />
                <Text style={localStyles.pickBtnText}>Thêm ảnh từ thư viện</Text>
              </Pressable>
            ) : null}
            {picked.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.thumbRow}>
                {picked.map((p) => (
                  <View key={p.uri} style={localStyles.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={localStyles.thumb} />
                    <Pressable style={localStyles.thumbRemove} onPress={() => removePicked(p.uri)}>
                      <MaterialIcons name="close" size={16} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <FormFieldLabel style={{ marginTop: 12 }}>
              Hoặc URL ảnh (mỗi dòng / cách nhau dấu phẩy)
            </FormFieldLabel>
            <TextInput
              value={imageUrlsText}
              onChangeText={setImageUrlsText}
              placeholder="https://..."
              placeholderTextColor={`${S.outline}80`}
              style={[styles.inputSoft, localStyles.urlArea]}
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={() => void onSubmit()}
            disabled={saving}
            activeOpacity={0.88}
            style={styles.saveWrap}>
            <LinearGradient
              colors={[S.primary, S.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.saveGradient, saving && { opacity: 0.65 }]}>
              <MaterialIcons name="send" size={22} color="#fff" />
              <Text style={styles.saveText}>{saving ? 'Đang gửi…' : 'Gửi phiếu (POST /receipts)'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Huỷ</Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={areaModal} animationType="slide" transparent onRequestClose={() => setAreaModal(false)}>
        <Pressable style={localStyles.modalBackdrop} onPress={() => setAreaModal(false)}>
          <Pressable style={localStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={localStyles.modalTitle}>Chọn khu</Text>
            <FlatList
              data={areas}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={localStyles.modalRow}
                  onPress={() => {
                    setAreaId(String(item.id));
                    setAreaModal(false);
                  }}>
                  <Text style={localStyles.modalRowText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={localStyles.emptyModal}>Chưa có khu.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={stationModal} animationType="slide" transparent onRequestClose={() => setStationModal(false)}>
        <Pressable style={localStyles.modalBackdrop} onPress={() => setStationModal(false)}>
          <Pressable style={localStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={localStyles.modalTitle}>Chọn trạm cân</Text>
            <FlatList
              data={stations}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={localStyles.modalRow}
                  onPress={() => {
                    setStationId(String(item.id));
                    setStationModal(false);
                  }}>
                  <Text style={localStyles.modalRowText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={localStyles.emptyModal}>Chưa có trạm hoặc không có quyền tải.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  warn: {
    color: '#b45309',
    fontSize: 13,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.surfaceQuiet,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}88`,
  },
  selectBtnText: {
    flex: 1,
    fontSize: 16,
    color: Brand.ink,
    fontWeight: '500',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: `${S.primary}12`,
    marginBottom: 12,
  },
  pickBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: S.primary,
  },
  thumbRow: {
    marginBottom: 8,
  },
  thumbWrap: {
    marginRight: 10,
    position: 'relative',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: S.surfaceContainerHigh,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#c62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '72%',
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    padding: 20,
    paddingBottom: 8,
    color: Brand.ink,
  },
  modalRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.outlineVariant,
  },
  modalRowText: {
    fontSize: 16,
    color: Brand.ink,
  },
  emptyModal: {
    padding: 24,
    textAlign: 'center',
    color: S.onSurfaceVariant,
  },
});
