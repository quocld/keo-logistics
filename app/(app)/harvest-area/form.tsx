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
import { parseIsoDateToLocal } from '@/lib/date/iso-date';
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

const END_PREFIX = 'Kết thúc dự kiến:';

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

function splitNotes(raw: string | null | undefined): { main: string; plannedEnd: string } {
  if (!raw?.trim()) return { main: '', plannedEnd: '' };
  const lines = raw.split('\n');
  const endIdx = lines.findIndex((l) => l.trimStart().startsWith(END_PREFIX));
  if (endIdx === -1) return { main: raw.trim(), plannedEnd: '' };
  const plannedEnd = lines[endIdx].replace(new RegExp(`^\\s*${END_PREFIX}\\s*`), '').trim();
  const main = [...lines.slice(0, endIdx), ...lines.slice(endIdx + 1)].join('\n').trim();
  return { main, plannedEnd };
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
  const [placeSearch, setPlaceSearch] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [siteContactName, setSiteContactName] = useState('');
  const [siteContactPhone, setSiteContactPhone] = useState('');
  const [siteContactEmail, setSiteContactEmail] = useState('');
  const [sitePurchaseDate, setSitePurchaseDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
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
      setGooglePlaceId(h.googlePlaceId != null ? String(h.googlePlaceId) : '');
      setPlaceSearch('');
      setSiteContactName(h.siteContactName ?? '');
      setSiteContactPhone(h.siteContactPhone ?? '');
      setSiteContactEmail(h.siteContactEmail != null ? String(h.siteContactEmail) : '');
      setSitePurchaseDate(h.sitePurchaseDate != null ? String(h.sitePurchaseDate) : '');
      const { main, plannedEnd } = splitNotes(h.siteNotes ?? undefined);
      setSiteNotes(main);
      setPlannedEndDate(plannedEnd);
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
    const g = optionalString(googlePlaceId);
    if (g !== undefined) body.googlePlaceId = g;
    const cn = optionalString(siteContactName);
    if (cn !== undefined) body.siteContactName = cn;
    const cp = optionalString(siteContactPhone);
    if (cp !== undefined) body.siteContactPhone = cp;
    const ce = optionalString(siteContactEmail);
    if (ce !== undefined) body.siteContactEmail = ce;
    const pd = optionalString(sitePurchaseDate);
    if (pd !== undefined) body.sitePurchaseDate = pd;

    const main = siteNotes.trim();
    const end = plannedEndDate.trim();
    const merged =
      end && main
        ? `${main}\n${END_PREFIX} ${end}`
        : end
          ? `${END_PREFIX} ${end}`
          : main;
    if (merged) body.siteNotes = merged;

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
    googlePlaceId,
    siteContactName,
    siteContactPhone,
    siteContactEmail,
    sitePurchaseDate,
    plannedEndDate,
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
        <View style={styles.headerRight}>
          <Pressable style={styles.headerIconBtn} hitSlop={8}>
            <MaterialIcons name="notifications-none" size={22} color={Brand.ink} />
          </Pressable>
          <View style={styles.headerDivider} />
          <Pressable
            style={styles.helpBtn}
            hitSlop={8}
            onPress={() => Alert.alert('Hỗ trợ', 'Liên hệ quản trị KeoTram hoặc xem tài liệu API.')}>
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

          <FormFieldLabel required>Tên khu khai thác</FormFieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Phân khu A1 - Đồi Thông"
            placeholderTextColor={`${S.outline}80`}
            style={styles.inputSoft}
          />

          <View style={styles.twoCol}>
            <View style={styles.colHalf}>
              <FormFieldLabel>Diện tích (ha)</FormFieldLabel>
              <FieldIconInput
                icon="straighten"
                value={areaHectares}
                onChangeText={setAreaHectares}
                placeholder="0.0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.colHalf}>
              <FormFieldLabel>Sản lượng dự kiến (tấn)</FormFieldLabel>
              <FieldIconInput
                icon="fitness-center"
                value={targetTons}
                onChangeText={setTargetTons}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <FormFieldLabel>Quản lý khu trực tiếp</FormFieldLabel>
          <View style={styles.fieldIconRow}>
            <MaterialIcons name="person" size={20} color={`${S.outline}99`} style={styles.fieldIcon} />
            <TextInput
              value={siteContactName}
              onChangeText={setSiteContactName}
              placeholder="Họ tên người phụ trách"
              placeholderTextColor={`${S.outline}80`}
              style={styles.fieldIconInput}
            />
          </View>

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
          <Text style={styles.sectionEyebrow}>Kế hoạch thời gian</Text>
          <Text style={styles.fieldApiHint}>
            Trường API: <Text style={styles.fieldApiMono}>sitePurchaseDate</Text> · Ngày kết thúc dự kiến được gộp vào{' '}
            <Text style={styles.fieldApiMono}>siteNotes</Text> (dòng {END_PREFIX} …)
          </Text>
          <View style={styles.twoCol}>
            <View style={styles.colHalf}>
              <FormDatePickerField
                label="Ngày bắt đầu dự kiến"
                value={sitePurchaseDate}
                onChangeValue={setSitePurchaseDate}
                placeholder="Chọn ngày"
              />
            </View>
            <View style={styles.colHalf}>
              <FormDatePickerField
                label="Ngày kết thúc dự kiến"
                value={plannedEndDate}
                onChangeValue={setPlannedEndDate}
                placeholder="Chọn ngày"
                minimumDate={parseIsoDateToLocal(sitePurchaseDate) ?? undefined}
              />
            </View>
          </View>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <Text style={styles.sectionEyebrowMap}>Vị trí bản đồ</Text>
            <View style={styles.gpsPill}>
              <Text style={styles.gpsPillText}>BẢN ĐỒ</Text>
            </View>
          </View>
          <View style={styles.mapVisual}>
            <LinearGradient
              colors={['#c8e6c9', S.surfaceContainerLow, '#e8f5e9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.mapPinWrap}>
              <MaterialIcons name="place" size={36} color={S.primary} />
            </View>
            <View style={styles.mapSearchOverlay}>
              <MaterialIcons name="search" size={18} color={S.primary} />
              <TextInput
                value={placeSearch}
                onChangeText={setPlaceSearch}
                placeholder="Tìm kiếm tọa độ/địa danh…"
                placeholderTextColor={`${S.outline}99`}
                style={styles.mapSearchInput}
              />
            </View>
          </View>
          <Text style={styles.fieldApiHint}>
            Chọn điểm trên bản đồ để gửi <Text style={styles.fieldApiMono}>latitude</Text> /{' '}
            <Text style={styles.fieldApiMono}>longitude</Text> (phù hợp khu rừng). Ô tìm kiếm chỉ hỗ trợ UI.{' '}
            <Text style={styles.fieldApiMono}>googlePlaceId</Text> tuỳ chọn — sẽ xóa khi xác nhận vị trí từ bản đồ.
          </Text>
          <Text style={styles.coordEyebrow}>Tọa độ GPS</Text>
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
            <>
              <View style={harvestLocalStyles.coordReadout}>
                <Text style={harvestLocalStyles.coordReadoutText}>{coordSummary}</Text>
              </View>
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [harvestLocalStyles.pickMapBtn, pressed && { opacity: 0.9 }]}>
                <MaterialIcons name="map" size={20} color="#fff" />
                <Text style={harvestLocalStyles.pickMapBtnText}>Chọn trên bản đồ</Text>
              </Pressable>
            </>
          )}
          <FormFieldLabel style={{ marginTop: 12 }}>Google Place ID (tuỳ chọn)</FormFieldLabel>
          <TextInput
            value={googlePlaceId}
            onChangeText={setGooglePlaceId}
            placeholder="Chỉ khi có từ Google Places; bản đồ sẽ xóa trường này"
            placeholderTextColor={`${S.outline}80`}
            style={styles.inputSoftMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Liên hệ & ghi chú</Text>
          <FormFieldLabel>Số điện thoại</FormFieldLabel>
          <TextInput
            value={siteContactPhone}
            onChangeText={setSiteContactPhone}
            placeholder="0901234567"
            keyboardType="phone-pad"
            style={styles.inputSoft}
            placeholderTextColor={`${S.outline}80`}
          />
          <FormFieldLabel>Email</FormFieldLabel>
          <TextInput
            value={siteContactEmail}
            onChangeText={setSiteContactEmail}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.inputSoft}
            placeholderTextColor={`${S.outline}80`}
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
        setGooglePlaceId('');
      }}
    />
    </>
  );
}

const harvestLocalStyles = StyleSheet.create({
  coordReadout: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: S.surfaceContainerLow,
    borderWidth: 1,
    borderColor: S.outlineVariant,
  },
  coordReadoutText: {
    fontSize: 14,
    color: S.onSurfaceVariant,
  },
  pickMapBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: S.primary,
  },
  pickMapBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
