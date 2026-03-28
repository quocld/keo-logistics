import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
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

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const h = await getHarvestArea(id);
      setName(h.name ?? '');
      setStatus((h.status as HarvestAreaStatus) || 'preparing');
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
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tải được khu');
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
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không lưu được');
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

          <Text style={styles.fieldLabel}>Tên khu khai thác</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Phân khu A1 - Đồi Thông"
            placeholderTextColor={`${S.outline}80`}
            style={styles.inputSoft}
          />

          <View style={styles.twoCol}>
            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>Diện tích (ha)</Text>
              <FieldIconInput
                icon="straighten"
                value={areaHectares}
                onChangeText={setAreaHectares}
                placeholder="0.0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>Sản lượng dự kiến (tấn)</Text>
              <FieldIconInput
                icon="fitness-center"
                value={targetTons}
                onChangeText={setTargetTons}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Quản lý khu trực tiếp</Text>
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

          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Trạng thái</Text>
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
          <View style={styles.twoCol}>
            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>Ngày bắt đầu dự kiến</Text>
              <TextInput
                value={sitePurchaseDate}
                onChangeText={setSitePurchaseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={`${S.outline}80`}
                style={styles.inputSoft}
              />
            </View>
            <View style={styles.colHalf}>
              <Text style={styles.fieldLabel}>Ngày kết thúc dự kiến</Text>
              <TextInput
                value={plannedEndDate}
                onChangeText={setPlannedEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={`${S.outline}80`}
                style={styles.inputSoft}
              />
            </View>
          </View>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <Text style={styles.sectionEyebrowMap}>Vị trí bản đồ</Text>
            <View style={styles.gpsPill}>
              <Text style={styles.gpsPillText}>GPS ACTIVE</Text>
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
          <Text style={styles.coordEyebrow}>Thông tin tọa độ</Text>
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
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Google Place ID (tuỳ chọn)</Text>
          <TextInput
            value={googlePlaceId}
            onChangeText={setGooglePlaceId}
            placeholder="Nhập nếu có"
            placeholderTextColor={`${S.outline}80`}
            style={styles.inputSoftMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Liên hệ & ghi chú</Text>
          <Text style={styles.fieldLabel}>Số điện thoại</Text>
          <TextInput
            value={siteContactPhone}
            onChangeText={setSiteContactPhone}
            placeholder="0901234567"
            keyboardType="phone-pad"
            style={styles.inputSoft}
            placeholderTextColor={`${S.outline}80`}
          />
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={siteContactEmail}
            onChangeText={setSiteContactEmail}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.inputSoft}
            placeholderTextColor={`${S.outline}80`}
          />
          <Text style={styles.fieldLabel}>Ghi chú</Text>
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
            <Text style={styles.fieldLabel}>Owner ID *</Text>
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

        <Pressable onPress={() => void onSubmit()} disabled={saving} style={styles.saveWrap}>
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
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Hủy bỏ và quay lại</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.canvas },
  root: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Brand.canvas,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  backBtn: { marginRight: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: Brand.ink,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { padding: 8 },
  headerDivider: {
    width: 1,
    height: 24,
    backgroundColor: `${S.outlineVariant}55`,
    marginHorizontal: 4,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  helpBtnText: { fontSize: 14, fontWeight: '500', color: Brand.ink },
  headerHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: S.surfaceContainerLow,
  },
  sectionCard: {
    backgroundColor: Brand.surface,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 3,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.ink,
    marginBottom: 8,
  },
  inputSoft: {
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Brand.ink,
    marginBottom: 16,
  },
  inputSoftMuted: {
    backgroundColor: S.surfaceContainerHigh,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Brand.ink,
    marginBottom: 0,
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 16, marginBottom: 0 },
  colHalf: { flex: 1, minWidth: 0 },
  fieldIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 8,
    paddingLeft: 12,
    marginBottom: 16,
  },
  fieldIcon: { marginRight: 4 },
  fieldIconInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 16,
    color: Brand.ink,
  },
  chipsScroll: { flexGrow: 0, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.chipMuted,
    marginRight: 8,
  },
  chipOn: { backgroundColor: S.primary },
  chipTxt: { fontSize: 13, fontWeight: '600', color: Brand.inkMuted },
  chipTxtOn: { color: '#fff' },
  mapCard: {
    backgroundColor: S.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  mapCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionEyebrowMap: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
  },
  gpsPill: {
    backgroundColor: S.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gpsPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: S.onSecondaryContainer,
  },
  mapVisual: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPinWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  mapSearchOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Brand.surface}e6`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}30`,
  },
  mapSearchInput: { flex: 1, fontSize: 14, color: Brand.ink, padding: 0 },
  coordEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: S.onSurfaceVariant,
    marginTop: 16,
    marginBottom: 8,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: S.surfaceContainerHigh,
    borderRadius: 8,
    padding: 12,
  },
  coordInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: `${Brand.ink}99`,
  },
  saveWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: S.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: S.primary },
});
