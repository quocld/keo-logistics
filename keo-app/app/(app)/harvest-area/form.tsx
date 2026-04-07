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

import { FormDatePickerField } from '@/components/date/FormDatePickerField';
import { FormFieldLabel } from '@/components/forms/FormFieldLabel';
import { LocationMapPickerModal } from '@/components/location/LocationMapPickerModal';
import { stitchHarvestFormStyles as styles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { createHarvestArea, getHarvestArea, updateHarvestArea } from '@/lib/api/harvest-areas';
import type { HarvestAreaCreatePayload, HarvestAreaStatus } from '@/lib/types/ops';

const S = Brand.stitch;

const STATUS_OPTIONS: { value: HarvestAreaStatus; label: string }[] = [
  { value: 'preparing', label: 'Chuẩn bị' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'paused', label: 'Tạm dừng' },
  { value: 'awaiting_renewal', label: 'Chờ gia hạn' },
  { value: 'inactive', label: 'Ngưng' },
  { value: 'completed', label: 'Hoàn thành' },
];

function coerceHarvestStatus(raw: unknown): HarvestAreaStatus {
  const s =
    typeof raw === 'object' && raw !== null && 'name' in raw
      ? String((raw as { name: string }).name).toLowerCase().trim()
      : String(raw ?? '')
          .toLowerCase()
          .trim();
  const hit = STATUS_OPTIONS.find((o) => o.value === s);
  return hit?.value ?? 'preparing';
}

/** Dòng cũ trong ghi chú — bỏ khi mở form để không lưu lại. */
const LEGACY_NOTES_END_PREFIX = 'Kết thúc dự kiến:';

function stripLegacyPlannedEndFromNotes(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  const lines = raw.split('\n');
  const endIdx = lines.findIndex((l) => l.trimStart().startsWith(LEGACY_NOTES_END_PREFIX));
  if (endIdx === -1) return raw.trim();
  return [...lines.slice(0, endIdx), ...lines.slice(endIdx + 1)].join('\n').trim();
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

export default function HarvestAreaFormScreen() {
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const idRaw = idParam == null ? undefined : typeof idParam === 'string' ? idParam : idParam[0];
  const id = idRaw && idRaw !== 'undefined' ? idRaw : undefined;
  const isEdit = Boolean(id);

  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [status, setStatus] = useState<HarvestAreaStatus>('preparing');
  const [areaHectares, setAreaHectares] = useState('');
  const [targetTons, setTargetTons] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [siteContactName, setSiteContactName] = useState('');
  const [siteContactPhone, setSiteContactPhone] = useState('');
  const [sitePurchaseDate, setSitePurchaseDate] = useState('');
  const [siteNotes, setSiteNotes] = useState('');
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

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const h = await getHarvestArea(id);
      setName(h.name ?? '');
      setStatus(coerceHarvestStatus(h.status));
      setAreaHectares(h.areaHectares != null ? String(h.areaHectares) : '');
      setTargetTons(h.targetTons != null ? String(h.targetTons) : '');
      setLatitude(h.latitude != null ? String(h.latitude) : '');
      setLongitude(h.longitude != null ? String(h.longitude) : '');
      setSiteContactName(h.siteContactName ?? '');
      setSiteContactPhone(h.siteContactPhone ?? '');
      setSitePurchaseDate(h.sitePurchaseDate != null ? String(h.sitePurchaseDate) : '');
      setSiteNotes(stripLegacyPlannedEndFromNotes(h.siteNotes ?? undefined));
      setOwnerIdStr(h.ownerId != null ? String(h.ownerId) : '');
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tải được khu'));
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (isEdit) void load();
  }, [isEdit, load]);

  const buildPayload = useCallback((): HarvestAreaCreatePayload => {
    const body: HarvestAreaCreatePayload = {
      name: name.trim(),
      status,
    };
    const ah = parseOptionalNumber(areaHectares);
    if (ah !== undefined) body.areaHectares = ah;
    const tt = parseOptionalNumber(targetTons);
    if (tt !== undefined) body.targetTons = tt;
    const lat = parseOptionalNumber(latitude);
    if (lat !== undefined) body.latitude = lat;
    const lng = parseOptionalNumber(longitude);
    if (lng !== undefined) body.longitude = lng;
    const cn = optionalString(siteContactName);
    if (cn !== undefined) body.siteContactName = cn;
    const cp = optionalString(siteContactPhone);
    if (cp !== undefined) body.siteContactPhone = cp;
    const pd = optionalString(sitePurchaseDate);
    if (pd !== undefined) body.sitePurchaseDate = pd;

    const notes = siteNotes.trim();
    if (notes) body.siteNotes = notes;

    if (!isEdit && user?.role === 'admin') {
      const oid = Number.parseInt(ownerIdStr.trim(), 10);
      if (Number.isFinite(oid)) body.ownerId = oid;
    }

    return body;
  }, [
    name,
    status,
    areaHectares,
    targetTons,
    latitude,
    longitude,
    siteContactName,
    siteContactPhone,
    sitePurchaseDate,
    siteNotes,
    ownerIdStr,
    isEdit,
    user?.role,
  ]);

  const onSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khu.');
      return;
    }
    if (!isEdit && user?.role === 'admin' && !ownerIdStr.trim()) {
      Alert.alert('Thiếu thông tin', 'Admin cần nhập Owner ID khi tạo khu.');
      return;
    }

    setSaving(true);
    try {
      const body = buildPayload();
      if (isEdit && id) {
        await updateHarvestArea(id, body);
      } else {
        await createHarvestArea(body);
      }
      router.back();
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không lưu được'));
    } finally {
      setSaving(false);
    }
  }, [name, isEdit, id, buildPayload, router, user?.role, ownerIdStr]);

  if (loading) {
    return (
      <View style={styles.centered}>
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
          <MaterialIcons name="add-circle" size={22} color={Brand.forest} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isEdit ? 'Cập nhật khu khai thác' : 'Thêm Khu Khai Thác Mới'}
          </Text>
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

          <FormFieldLabel required>Tên khu khai thác</FormFieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Phân khu A1 - Đồi Thông"
            placeholderTextColor={`${S.outline}80`}
            style={styles.inputSoft}
          />

          <FormFieldLabel>Diện tích (ha)</FormFieldLabel>
          <FieldIconInput
            icon="straighten"
            value={areaHectares}
            onChangeText={setAreaHectares}
            placeholder="0.0"
            keyboardType="decimal-pad"
          />
          <FormFieldLabel>Sản lượng dự kiến (tấn)</FormFieldLabel>
          <FieldIconInput
            icon="fitness-center"
            value={targetTons}
            onChangeText={setTargetTons}
            placeholder="0"
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
            <View style={harvestLocalStyles.locationCard}>
              <View style={harvestLocalStyles.locationRow}>
                <MaterialIcons name="place" size={22} color={S.primary} />
                <Text style={harvestLocalStyles.locationSummary} numberOfLines={2}>
                  {coordSummary}
                </Text>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [
                    harvestLocalStyles.locationMapChip,
                    pressed && harvestLocalStyles.locationMapChipPressed,
                  ]}>
                  <MaterialIcons name="map" size={18} color="#fff" />
                  <Text style={harvestLocalStyles.locationMapChipText}>Bản đồ</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Liên hệ & ghi chú</Text>
          <FormFieldLabel>Chủ rừng</FormFieldLabel>
          <View style={styles.fieldIconRow}>
            <MaterialIcons name="person" size={20} color={`${S.outline}99`} style={styles.fieldIcon} />
            <TextInput
              value={siteContactName}
              onChangeText={setSiteContactName}
              placeholder="Họ tên chủ rừng / người phụ trách"
              placeholderTextColor={`${S.outline}80`}
              style={styles.fieldIconInput}
            />
          </View>
          <FormFieldLabel>Số điện thoại</FormFieldLabel>
          <TextInput
            value={siteContactPhone}
            onChangeText={setSiteContactPhone}
            placeholder="0901234567"
            keyboardType="phone-pad"
            style={styles.inputSoft}
            placeholderTextColor={`${S.outline}80`}
          />
          <FormDatePickerField
            label="Ngày mua bãi"
            value={sitePurchaseDate}
            onChangeValue={setSitePurchaseDate}
            placeholder="Chọn ngày"
          />
          <FormFieldLabel>Ghi chú</FormFieldLabel>
          <TextInput
            value={siteNotes}
            onChangeText={setSiteNotes}
            placeholder="Ghi chú thêm"
            multiline
            style={[styles.inputSoft, styles.textArea]}
            placeholderTextColor={`${S.outline}80`}
          />
        </View>

        {!isEdit && user?.role === 'admin' ? (
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
              {saving ? 'Đang lưu…' : isEdit ? 'Cập nhật khu' : 'Lưu Khu Khai Thác'}
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
      title="Chọn vị trí khu khai thác"
      onConfirm={(c) => {
        setLatitude(String(c.latitude));
        setLongitude(String(c.longitude));
      }}
    />
    </>
  );
}

const harvestLocalStyles = StyleSheet.create({
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
