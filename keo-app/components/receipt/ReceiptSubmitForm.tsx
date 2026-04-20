import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { getErrorMessage } from '@/lib/api/errors';
import { formatVndShortVi } from '@/lib/format/vnd-vi';
import { uploadOpsFile } from '@/lib/api/files';
import { normalizePickedImageForUpload } from '@/lib/images/normalize-picked-image';
import { listHarvestAreas } from '@/lib/api/harvest-areas';
import { listOwnerDrivers } from '@/lib/api/owner-drivers';
import { createReceipt } from '@/lib/api/receipts';
import { listWeighingStations } from '@/lib/api/weighing-stations';
import type { HarvestArea, OwnerDriverUser, ReceiptCreatePayload, WeighingStation } from '@/lib/types/ops';

const S = Brand.stitch;
const isNative = Platform.OS !== 'web';

export type ReceiptSubmitVariant = 'owner' | 'driver';

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

function parseNumber(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Format integer thành chuỗi vi-VN (dấu . phân nghìn): 10000000 → "10.000.000" */
function fmtIntVN(digits: string): string {
  if (!digits) return '';
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n.toLocaleString('vi-VN') : digits;
}

function driverDisplayName(d: OwnerDriverUser): string {
  const parts = [d.firstName, d.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return d.email;
}

function formatDateTimeVN(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}  ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type ReceiptSubmitFormProps = {
  variant: ReceiptSubmitVariant;
  /** Khi mở từ màn khu — gán sẵn khu khai thác */
  initialHarvestAreaId?: string;
};

export function ReceiptSubmitForm({ variant, initialHarvestAreaId }: ReceiptSubmitFormProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [areas, setAreas] = useState<HarvestArea[]>([]);
  const [stations, setStations] = useState<WeighingStation[]>([]);
  const [drivers, setDrivers] = useState<OwnerDriverUser[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsErr, setListsErr] = useState<string | null>(null);

  const [driverUserId, setDriverUserId] = useState<string>('');
  const [areaId, setAreaId] = useState<string>('');
  const [stationId, setStationId] = useState<string>('');
  // weight: raw = chuỗi số chuẩn "12.5"; display = vi-VN "12,5" hoặc "1.500,5"
  const [weightRaw, setWeightRaw] = useState('');
  const [weightDisplay, setWeightDisplay] = useState('');
  // amount: raw = chuỗi số nguyên "10000000"; display = vi-VN "10.000.000"
  const [amountRaw, setAmountRaw] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [notes, setNotes] = useState('');
  const [picked, setPicked] = useState<PickedImage[]>([]);
  const [saving, setSaving] = useState(false);

  const handleAmountChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '');
    setAmountRaw(digits);
    setAmountDisplay(fmtIntVN(digits));
  }, []);

  const handleWeightChange = useCallback((text: string) => {
    // Xoá dấu . phân nghìn (vi-VN), chuẩn hoá , → . cho JS
    const noThousands = text.replace(/\./g, '');
    const normalized = noThousands.replace(',', '.');
    // Chỉ cho phép số nguyên hoặc số thập phân hợp lệ
    if (normalized !== '' && !/^\d*\.?\d*$/.test(normalized)) return;
    setWeightRaw(normalized);
    if (!normalized) { setWeightDisplay(''); return; }
    const dotIdx = normalized.indexOf('.');
    if (dotIdx === -1) {
      setWeightDisplay(fmtIntVN(normalized));
    } else {
      const intStr = normalized.slice(0, dotIdx);
      const decStr = normalized.slice(dotIdx + 1);
      setWeightDisplay(`${fmtIntVN(intStr)},${decStr}`);
    }
  }, []);

  // Owner-only: chọn ngày giờ phiếu (tuỳ chọn)
  const [receiptDate, setReceiptDate] = useState<Date>(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  // Android dùng sequential date → time; iOS dùng datetime inline
  const [pendingDate, setPendingDate] = useState<Date>(new Date());

  const [areaModal, setAreaModal] = useState(false);
  const [stationModal, setStationModal] = useState(false);
  const [driverModal, setDriverModal] = useState(false);

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
      } else {
        setStations([]);
        setListsErr(ws.message);
      }
      if (variant === 'owner') {
        const od = await listOwnerDrivers({ page: 1, limit: 200 });
        setDrivers(od.data);
      } else {
        setDrivers([]);
      }
    } catch (e) {
      setListsErr(getErrorMessage(e, 'Không tải danh sách'));
      setAreas([]);
      setStations([]);
      setDrivers([]);
    } finally {
      setListsLoading(false);
    }
  }, [variant]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!initialHarvestAreaId?.trim()) return;
    const key = String(initialHarvestAreaId).trim();
    if (areas.some((a) => String(a.id) === key)) {
      setAreaId(key);
    }
  }, [initialHarvestAreaId, areas]);

  const areaLabel = useCallback(() => {
    const a = areas.find((x) => String(x.id) === areaId);
    return a ? `${a.name}` : 'Chọn khu khai thác';
  }, [areas, areaId]);

  const stationLabel = useCallback(() => {
    const s = stations.find((x) => String(x.id) === stationId);
    return s ? `${s.name}` : 'Chọn trạm cân (tuỳ chọn)';
  }, [stations, stationId]);

  const driverLabel = useCallback(() => {
    const d = drivers.find((x) => String(x.id) === driverUserId);
    return d ? driverDisplayName(d) : 'Chọn tài xế';
  }, [drivers, driverUserId]);

  // --- Chụp hình ---
  const takePhoto = useCallback(async () => {
    if (!isNative) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền camera để chụp hình.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    try {
      const normalized = await normalizePickedImageForUpload({ uri: a.uri, index: picked.length, width: a.width });
      setPicked((prev) => [...prev, { uri: normalized.uri, name: normalized.name, mime: normalized.mimeType }]);
    } catch (e) {
      Alert.alert('Ảnh', getErrorMessage(e, 'Không xử lý được ảnh'));
    }
  }, [picked.length]);

  // --- Thêm từ thư viện ---
  const pickImages = useCallback(async () => {
    if (!isNative) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 8,
      quality: 0.85,
    });
    if (res.canceled) return;
    const batch: PickedImage[] = [];
    for (let i = 0; i < res.assets.length; i++) {
      const a = res.assets[i];
      try {
        const normalized = await normalizePickedImageForUpload({ uri: a.uri, index: i, width: a.width });
        batch.push({ uri: normalized.uri, name: normalized.name, mime: normalized.mimeType });
      } catch (e) {
        Alert.alert('Ảnh', getErrorMessage(e, 'Không xử lý được ảnh'));
        return;
      }
    }
    setPicked((prev) => [...prev, ...batch]);
  }, []);

  const removePicked = useCallback((uri: string) => {
    setPicked((prev) => prev.filter((p) => p.uri !== uri));
  }, []);

  // --- Date picker handlers ---
  const onDateChange = useCallback(
    (_event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') {
        setDatePickerVisible(false);
        if (selected) {
          setPendingDate(selected);
          setTimePickerVisible(true);
        }
      } else {
        if (selected) setReceiptDate(selected);
      }
    },
    [],
  );

  const onTimeChange = useCallback(
    (_event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') {
        setTimePickerVisible(false);
        if (selected) setReceiptDate(selected);
        else setReceiptDate(pendingDate);
      } else {
        if (selected) setReceiptDate(selected);
      }
    },
    [pendingDate],
  );

  const openDatePicker = useCallback(() => {
    setPendingDate(receiptDate);
    if (Platform.OS === 'android') {
      setDatePickerVisible(true);
    } else {
      setDatePickerVisible((v) => !v);
    }
  }, [receiptDate]);

  const onSubmit = useCallback(async () => {
    if (variant === 'owner' && !driverUserId) {
      Alert.alert('Thiếu dữ liệu', 'Chọn tài xế (bắt buộc khi owner tạo phiếu).');
      return;
    }
    if (!areaId) {
      Alert.alert('Thiếu dữ liệu', 'Chọn khu khai thác.');
      return;
    }
    const w = parseNumber(weightRaw);
    if (w == null || w <= 0) {
      Alert.alert('Thiếu dữ liệu', 'Nhập khối lượng (tấn) hợp lệ.');
      return;
    }
    const amt = parseNumber(amountRaw);
    if (amt == null || amt < 0) {
      Alert.alert('Thiếu dữ liệu', 'Nhập số tiền (VND) hợp lệ.');
      return;
    }
    if (variant !== 'owner' && !picked.length) {
      Alert.alert('Ảnh bill', 'Thêm ít nhất một ảnh bill.');
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
        receiptDate: (variant === 'owner' ? receiptDate : new Date()).toISOString(),
        imageFileIds,
      };
      if (variant === 'owner') {
        body.driverUserId = Number(driverUserId);
      }
      if (stationId) body.weighingStationId = stationId;
      const n = notes.trim();
      if (n) body.notes = n;

      await createReceipt(body);
      Alert.alert('Đã tạo', 'Phiếu đã gửi lên server.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tạo được phiếu'));
    } finally {
      setSaving(false);
    }
  }, [variant, driverUserId, areaId, stationId, weightRaw, amountRaw, notes, picked, receiptDate, router]);

  const headerTitle = variant === 'owner' ? 'Tạo phiếu cân' : 'Gửi phiếu cân';

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
            {headerTitle}
          </Text>
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
          {listsErr ? <Text style={localStyles.warn}>{listsErr}</Text> : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Khu & trạm</Text>

            {variant === 'owner' ? (
              <>
                <FormFieldLabel required>Tài xế</FormFieldLabel>
                <Pressable onPress={() => setDriverModal(true)} style={localStyles.selectBtn}>
                  <Text style={localStyles.selectBtnText} numberOfLines={2}>
                    {driverLabel()}
                  </Text>
                  <MaterialIcons name="expand-more" size={22} color={S.primary} />
                </Pressable>
                {drivers.length === 0 ? (
                  <Text style={localStyles.warn}>Chưa có tài xế managed. Tạo tài xế trong mục Tài xế.</Text>
                ) : null}
              </>
            ) : null}

            <FormFieldLabel required style={{ marginTop: variant === 'owner' ? 16 : 0 }}>
              Khu khai thác
            </FormFieldLabel>
            <Pressable onPress={() => setAreaModal(true)} style={localStyles.selectBtn}>
              <Text style={localStyles.selectBtnText} numberOfLines={2}>
                {areaLabel()}
              </Text>
              <MaterialIcons name="expand-more" size={22} color={S.primary} />
            </Pressable>

            <FormFieldLabel style={{ marginTop: 16 }}>Trạm cân</FormFieldLabel>
            <Pressable onPress={() => setStationModal(true)} style={localStyles.selectBtn}>
              <Text style={localStyles.selectBtnText} numberOfLines={2}>
                {stationLabel()}
              </Text>
              <MaterialIcons name="expand-more" size={22} color={S.primary} />
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Số liệu phiếu</Text>
            {(() => {
              const w = parseNumber(weightRaw);
              const amt = parseNumber(amountRaw);
              if (w == null || w <= 0 || amt == null || amt < 0) return null;
              const unitPrice = w > 0 ? amt / w : 0;
              const weightStr = w.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
              return (
                <View style={localStyles.summaryRow}>
                  <MaterialIcons name="summarize" size={15} color={S.primary} />
                  <Text style={localStyles.summaryText}>
                    {weightStr} tấn — {formatVndShortVi(amt)}{' '}
                    <Text style={localStyles.summaryUnit}>(đơn giá: {formatVndShortVi(unitPrice)}/tấn)</Text>
                  </Text>
                </View>
              );
            })()}
            <FormFieldLabel required style={parseNumber(weightRaw) != null && parseNumber(amountRaw) != null ? { marginTop: 12 } : {}}>Khối lượng (tấn)</FormFieldLabel>
            <FieldIconInput
              icon="scale"
              value={weightDisplay}
              onChangeText={handleWeightChange}
              placeholder="12,5"
              keyboardType="default"
            />
            <FormFieldLabel style={{ marginTop: 16 }} required>
              Số tiền (VND)
              {parseNumber(amountRaw) != null ? (
                <Text style={localStyles.amountPreview}> · {formatVndShortVi(parseNumber(amountRaw)!)}</Text>
              ) : null}
            </FormFieldLabel>
            <FieldIconInput
              icon="payments"
              value={amountDisplay}
              onChangeText={handleAmountChange}
              placeholder="15.000.000"
              keyboardType="number-pad"
            />
            <FormFieldLabel style={{ marginTop: 16 }}>Ghi chú</FormFieldLabel>
            <FieldIconInput
              icon="notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Ghi chú tuỳ chọn"
              multiline
            />
          </View>

          {/* Ngày giờ phiếu — chỉ owner */}
          {variant === 'owner' ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Ngày giờ phiếu</Text>
              <FormFieldLabel>Ngày giờ (tuỳ chọn)</FormFieldLabel>
              <Pressable onPress={openDatePicker} style={localStyles.selectBtn}>
                <MaterialIcons name="event" size={20} color={`${S.outline}99`} style={{ marginRight: 10 }} />
                <Text style={[localStyles.selectBtnText, { color: S.primary }]}>
                  {formatDateTimeVN(receiptDate)}
                </Text>
                <MaterialIcons name="edit" size={18} color={S.primary} />
              </Pressable>

              {/* iOS: picker inline toggle */}
              {Platform.OS === 'ios' && datePickerVisible ? (
                <View style={localStyles.iosPickerWrap}>
                  <DateTimePicker
                    value={receiptDate}
                    mode="datetime"
                    display="spinner"
                    onChange={onDateChange}
                    locale="vi-VN"
                    style={localStyles.iosPicker}
                  />
                  <Pressable onPress={() => setDatePickerVisible(false)} style={localStyles.iosPickerDone}>
                    <Text style={localStyles.iosPickerDoneText}>Xong</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Android: date picker dialog */}
              {Platform.OS === 'android' && datePickerVisible ? (
                <DateTimePicker
                  value={pendingDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              ) : null}

              {/* Android: time picker dialog (shown after date) */}
              {Platform.OS === 'android' && timePickerVisible ? (
                <DateTimePicker
                  value={pendingDate}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <FormSectionLabel required={variant !== 'owner'}>
              Ảnh bill{variant === 'owner' ? ' (tuỳ chọn)' : ''}
            </FormSectionLabel>
            <View style={localStyles.imageActions}>
              <Pressable onPress={() => void pickImages()} style={[localStyles.imgBtn, { flex: 1 }]}>
                <MaterialIcons name="add-photo-alternate" size={20} color={S.primary} />
                <Text style={localStyles.imgBtnText}>Thư viện</Text>
              </Pressable>
              <Pressable onPress={() => void takePhoto()} style={[localStyles.imgBtn, { flex: 1 }]}>
                <MaterialIcons name="camera-alt" size={20} color={S.primary} />
                <Text style={localStyles.imgBtnText}>Chụp hình</Text>
              </Pressable>
            </View>
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
              <Text style={styles.saveText}>{saving ? 'Đang gửi…' : 'Gửi phiếu'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Huỷ</Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={driverModal} animationType="slide" transparent onRequestClose={() => setDriverModal(false)}>
        <Pressable style={localStyles.modalBackdrop} onPress={() => setDriverModal(false)}>
          <Pressable style={localStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={localStyles.modalTitle}>Chọn tài xế</Text>
            <FlatList
              data={drivers}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={localStyles.modalRow}
                  onPress={() => {
                    setDriverUserId(String(item.id));
                    setDriverModal(false);
                  }}>
                  <Text style={localStyles.modalRowText}>{driverDisplayName(item)}</Text>
                  <Text style={localStyles.modalRowSub}>{item.email}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={localStyles.emptyModal}>Chưa có tài xế managed.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={areaModal} animationType="slide" transparent onRequestClose={() => setAreaModal(false)}>
        <Pressable style={localStyles.modalBackdrop} onPress={() => setAreaModal(false)}>
          <Pressable style={localStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={localStyles.modalTitle}>Chọn khu</Text>
            <FlatList
              data={areas.filter((a) => a.status === 'active')}
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
              ListEmptyComponent={<Text style={localStyles.emptyModal}>Chưa có khu đang hoạt động.</Text>}
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
              ListEmptyComponent={<Text style={localStyles.emptyModal}>Chưa có trạm.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  amountPreview: {
    fontSize: 14,
    fontWeight: '600',
    color: S.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: `${S.primary}10`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${S.primary}28`,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: S.primary,
  },
  summaryUnit: {
    fontSize: 13,
    fontWeight: '400',
    color: S.onSurfaceVariant,
  },
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
  imageActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  imgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: `${S.primary}12`,
  },
  imgBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: S.primary,
  },
  thumbRow: {
    marginTop: 4,
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
  iosPickerWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Brand.surfaceQuiet,
  },
  iosPicker: {
    width: '100%',
  },
  iosPickerDone: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iosPickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: S.primary,
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
  modalRowSub: {
    fontSize: 13,
    color: S.onSurfaceVariant,
    marginTop: 4,
  },
  emptyModal: {
    padding: 24,
    textAlign: 'center',
    color: S.onSurfaceVariant,
  },
});
