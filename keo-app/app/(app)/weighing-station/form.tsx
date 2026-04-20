import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

import { FormFieldLabel } from '@/components/forms/FormFieldLabel';
import { LocationMapPickerModal } from '@/components/location/LocationMapPickerModal';
import { stitchHarvestFormStyles as styles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import {
  createWeighingStation,
  getWeighingStation,
  updateWeighingStation,
} from '@/lib/api/weighing-stations';
import type { WeighingStationCreatePayload, WeighingStationUpdatePayload } from '@/lib/types/ops';

const S = Brand.stitch;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngưng' },
];

function coerceWeighingStatus(raw: unknown): string {
  const s =
    typeof raw === 'object' && raw !== null && 'name' in raw
      ? String((raw as { name: string }).name).toLowerCase()
      : String(raw ?? '').toLowerCase();
  if (s.includes('inactive') || s.includes('disabled') || s.includes('ngưng')) return 'inactive';
  return 'active';
}

function parseOptionalNumber(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function optionalString(s: string): string | undefined {
  const t = s.trim();
  return t ? t : undefined;
}

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function FieldIconInput({
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'phone-pad' | 'email-address';
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
        style={styles.fieldIconInput}
      />
    </View>
  );
}

export default function WeighingStationFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const editId = typeof idParam === 'string' ? idParam : idParam?.[0];
  const isEdit = Boolean(editId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [status, setStatus] = useState('active');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [formattedAddress, setFormattedAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [ownerIdStr, setOwnerIdStr] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const pickerInitialCoordinate = useMemo(() => {
    const lat = parseOptionalNumber(latitude);
    const lng = parseOptionalNumber(longitude);
    if (lat === undefined || lng === undefined) return null;
    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  const coordSummary = useMemo(() => {
    const lat = parseOptionalNumber(latitude);
    const lng = parseOptionalNumber(longitude);
    if (lat === undefined || lng === undefined) return 'Chưa chọn vị trí trên bản đồ';
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, [latitude, longitude]);

  const buildPayload = useCallback((): WeighingStationCreatePayload => {
    const body: WeighingStationCreatePayload = {
      name: name.trim(),
      status,
    };
    const up = parseOptionalNumber(unitPrice);
    if (up !== undefined) body.unitPrice = up;
    const lat = parseOptionalNumber(latitude);
    if (lat !== undefined) body.latitude = lat;
    const lng = parseOptionalNumber(longitude);
    if (lng !== undefined) body.longitude = lng;
    const fa = optionalString(formattedAddress);
    if (fa !== undefined) body.formattedAddress = fa;
    const n = optionalString(notes);
    if (n !== undefined) body.notes = n;
    if (user?.role === 'admin') {
      const oid = Number.parseInt(ownerIdStr.trim(), 10);
      if (Number.isFinite(oid)) body.ownerId = oid;
    }
    return body;
  }, [name, unitPrice, status, latitude, longitude, formattedAddress, notes, ownerIdStr, user?.role]);

  const load = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    try {
      const w = await getWeighingStation(editId);
      setName(w.name ?? '');
      setUnitPrice(w.unitPrice != null ? String(w.unitPrice) : '');
      setStatus(coerceWeighingStatus(w.status));
      setLatitude(w.latitude != null ? String(w.latitude) : '');
      setLongitude(w.longitude != null ? String(w.longitude) : '');
      setFormattedAddress(w.formattedAddress ?? '');
      setNotes(w.notes != null ? String(w.notes) : '');
      const oid = w.ownerId;
      setOwnerIdStr(oid != null && Number.isFinite(Number(oid)) ? String(oid) : '');
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tải được trạm'));
      router.back();
    } finally {
      setLoading(false);
    }
  }, [editId, router]);

  useEffect(() => {
    if (isEdit) void load();
  }, [isEdit, load]);

  const onSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên trạm.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && editId) {
        const full = buildPayload();
        const patch: WeighingStationUpdatePayload = { ...full };
        await updateWeighingStation(editId, patch);
      } else {
        await createWeighingStation(buildPayload());
      }
      router.back();
    } catch (e) {
      Alert.alert(
        'Lỗi',
        getErrorMessage(e, isEdit ? 'Không cập nhật được' : 'Không tạo được trạm'),
      );
    } finally {
      setSaving(false);
    }
  }, [name, buildPayload, router, isEdit, editId]);

  if (loading) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <ActivityIndicator size="large" color={S.primary} />
      </View>
    );
  }

  return (
    <>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Brand.ink} />
          </Pressable>
          <MaterialIcons name={isEdit ? 'edit' : 'add-circle'} size={22} color={Brand.forest} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEdit ? 'Chỉnh sửa trạm cân' : 'Thêm Trạm Cân Mới'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.helpBtn}
            hitSlop={8}
            onPress={() =>
              Alert.alert(
                'Hỗ trợ',
                isEdit
                  ? 'PATCH /weighing-stations/:id — KeoTram Ops Postman.'
                  : 'POST /weighing-stations — KeoTram Ops Postman.',
              )
            }>
            <MaterialIcons name="help-outline" size={20} color={Brand.ink} />
            <Text style={styles.helpBtnText}>Hỗ trợ</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.headerHairline} />

      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Thông tin cơ bản</Text>

          <FormFieldLabel required>Tên trạm</FormFieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Trạm cân khu A"
            placeholderTextColor={`${S.outline}80`}
            style={styles.inputSoft}
          />

          <FormFieldLabel>Đơn giá (VND/tấn)</FormFieldLabel>
          <FieldIconInput
            icon="payments"
            value={unitPrice}
            onChangeText={setUnitPrice}
            placeholder="1250"
            keyboardType="decimal-pad"
          />

          <FormFieldLabel style={{ marginTop: 18 }}>Trạng thái</FormFieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {STATUS_OPTIONS.map((o) => {
              const sel = status === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setStatus(o.value)}
                  style={[styles.chip, sel && styles.chipOn]}>
                  <Text style={[styles.chipTxt, sel && styles.chipTxtOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Vị trí</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.coordRow}>
              <TextInput
                value={latitude}
                onChangeText={setLatitude}
                placeholder="Vĩ độ"
                placeholderTextColor={S.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={styles.coordInput}
              />
              <TextInput
                value={longitude}
                onChangeText={setLongitude}
                placeholder="Kinh độ"
                placeholderTextColor={S.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={styles.coordInput}
              />
            </View>
          ) : (
            <View style={localStyles.locationCard}>
              <View style={localStyles.locationRow}>
                <MaterialIcons name="place" size={22} color={S.primary} />
                <Text style={localStyles.locationSummary} numberOfLines={2}>
                  {coordSummary}
                </Text>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [
                    localStyles.locationMapChip,
                    pressed && localStyles.locationMapChipPressed,
                  ]}>
                  <MaterialIcons name="map" size={18} color="#fff" />
                  <Text style={localStyles.locationMapChipText}>Bản đồ</Text>
                </Pressable>
              </View>
            </View>
          )}
          <FormFieldLabel style={{ marginTop: 12 }}>Địa chỉ đầy đủ</FormFieldLabel>
          <TextInput
            value={formattedAddress}
            onChangeText={setFormattedAddress}
            placeholder="Mô tả địa điểm, lô rừng, huyện… (tuỳ chọn)"
            placeholderTextColor={`${S.outline}80`}
            style={[styles.inputSoft, styles.textArea, { minHeight: 72 }]}
            multiline
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Ghi chú</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ghi chú thêm"
            multiline
            style={[styles.inputSoft, styles.textArea]}
            placeholderTextColor={`${S.outline}80`}
          />
        </View>

        {user?.role === 'admin' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Quản trị</Text>
            <FormFieldLabel required>Owner ID</FormFieldLabel>
            <TextInput
              value={ownerIdStr}
              onChangeText={setOwnerIdStr}
              placeholder="2"
              keyboardType="number-pad"
              style={styles.inputSoft}
              placeholderTextColor={`${S.outline}80`}
            />
          </View>
        ) : null}

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
            <MaterialIcons name="save" size={22} color="#fff" />
            <Text style={styles.saveText}>
              {saving ? 'Đang lưu…' : isEdit ? 'Cập nhật trạm cân' : 'Lưu Trạm Cân'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Hủy bỏ và quay lại</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
    <LocationMapPickerModal
      visible={pickerOpen}
      onRequestClose={() => setPickerOpen(false)}
      initialCoordinate={pickerInitialCoordinate}
      title="Chọn vị trí trạm cân"
      onConfirm={(c) => {
        setLatitude(String(c.latitude));
        setLongitude(String(c.longitude));
      }}
    />
  </>
  );
}

const localStyles = StyleSheet.create({
  locationCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}aa`,
    backgroundColor: S.surfaceContainerLow,
    overflow: 'hidden',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  locationSummary: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: Brand.ink,
  },
  locationMapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: S.primary,
  },
  locationMapChipPressed: {
    opacity: 0.9,
  },
  locationMapChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
