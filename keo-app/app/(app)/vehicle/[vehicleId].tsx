import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { listAllOwnerDrivers, setOwnerDriverVehicle } from '@/lib/api/owner-drivers';
import { getVehicle, listVehicleExpenses, createVehicleExpense } from '@/lib/api/vehicles';
import type { OwnerDriverUser, Vehicle, VehicleExpense, VehicleExpenseType } from '@/lib/types/ops';

const S = Brand.stitch;

const EXPENSE_TYPES: { value: VehicleExpenseType; label: string; icon: 'local-gas-station' | 'build' | 'more-horiz' }[] =
  [
    { value: 'fuel', label: 'Nhiên liệu', icon: 'local-gas-station' },
    { value: 'repair', label: 'Sửa chữa', icon: 'build' },
    { value: 'other', label: 'Khác', icon: 'more-horiz' },
  ];

function displayDriverName(d: OwnerDriverUser): string {
  const parts = [d.firstName, d.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return d.email;
}

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN');
}

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { vehicleId: vehicleIdParam } = useLocalSearchParams<{ vehicleId?: string | string[] }>();
  const vehicleId = typeof vehicleIdParam === 'string' ? vehicleIdParam : vehicleIdParam?.[0];

  const isOwner = user?.role === 'owner';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const [driversLoading, setDriversLoading] = useState(false);
  const [driversOpen, setDriversOpen] = useState(false);
  const [driverQuery, setDriverQuery] = useState('');
  const [drivers, setDrivers] = useState<OwnerDriverUser[]>([]);

  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);

  const [expenseType, setExpenseType] = useState<VehicleExpenseType>('fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) return;
    const v = await getVehicle(vehicleId);
    setVehicle(v);
  }, [vehicleId]);

  const loadExpenses = useCallback(async () => {
    if (!vehicleId) return;
    setExpensesLoading(true);
    try {
      const res = await listVehicleExpenses(vehicleId, { page: 1, limit: 50 });
      setExpenses(res.data);
    } finally {
      setExpensesLoading(false);
    }
  }, [vehicleId]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadVehicle(), loadExpenses()]);
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tải được chi tiết xe'));
    } finally {
      setLoading(false);
    }
  }, [loadVehicle, loadExpenses]);

  useFocusEffect(
    useCallback(() => {
      void initialLoad();
    }, [initialLoad]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadVehicle(), loadExpenses()]);
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tải được dữ liệu'));
    } finally {
      setRefreshing(false);
    }
  }, [loadVehicle, loadExpenses]);

  const openDriverPicker = useCallback(async () => {
    if (!isOwner) {
      Alert.alert('Không hỗ trợ', 'Chỉ Owner mới gán/đổi tài xế cho xe.');
      return;
    }
    setDriversOpen(true);
    if (drivers.length) return;
    setDriversLoading(true);
    try {
      const all = await listAllOwnerDrivers({ pageSize: 50, maxPages: 20 });
      setDrivers(all);
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tải được danh sách tài xế'));
    } finally {
      setDriversLoading(false);
    }
  }, [drivers.length, isOwner]);

  const assignDriver = useCallback(
    async (driverIdToAssign: string | number | null) => {
      if (!vehicleId) return;
      if (!driverIdToAssign) return;
      try {
        await setOwnerDriverVehicle(driverIdToAssign, { vehicleId });
        await initialLoad();
        setDriversOpen(false);
      } catch (e) {
        Alert.alert('Lỗi', getErrorMessage(e, 'Không cập nhật được gán xe'));
      }
    },
    [vehicleId, initialLoad],
  );

  const onUnassign = useCallback(async () => {
    const currentDriverId = vehicle?.assignedDriver?.id ?? vehicle?.assignedDriverId;
    if (!currentDriverId) return;
    try {
      await setOwnerDriverVehicle(currentDriverId, { vehicleId: null });
      await initialLoad();
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không bỏ gán được tài xế'));
    }
  }, [vehicle?.assignedDriver?.id, vehicle?.assignedDriverId, initialLoad]);

  const onAddExpense = useCallback(async () => {
    if (!vehicleId) return;
    const amt = Number(String(expenseAmount).replace(/[^\d]/g, ''));
    if (!amt || amt <= 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số tiền hợp lệ.');
      return;
    }
    setSavingExpense(true);
    try {
      await createVehicleExpense(vehicleId, {
        expenseType,
        amount: amt,
        occurredAt: new Date().toISOString(),
        notes: expenseNotes.trim() || null,
      });
      setExpenseAmount('');
      setExpenseNotes('');
      await loadExpenses();
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tạo được chi phí'));
    } finally {
      setSavingExpense(false);
    }
  }, [vehicleId, expenseAmount, expenseNotes, expenseType, loadExpenses]);

  const title = useMemo(() => vehicle?.plate ?? 'Chi tiết xe', [vehicle?.plate]);

  const assignedLabel = useMemo(() => {
    if (!vehicle) return '—';
    const d = vehicle.assignedDriver;
    if (d) {
      const name = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
      return name || d.email || (d.id != null ? `#${String(d.id)}` : '—');
    }
    if (vehicle.assignedDriverId != null) return `#${String(vehicle.assignedDriverId)}`;
    return 'Chưa gán';
  }, [vehicle]);

  const displayedDrivers = useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => {
      const name = displayDriverName(d).toLowerCase();
      const email = d.email.toLowerCase();
      const id = String(d.id).toLowerCase();
      return name.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [drivers, driverQuery]);

  if (!vehicleId) {
    return (
      <View style={st.center}>
        <Text style={st.muted}>Thiếu mã phương tiện.</Text>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <View style={[st.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable onPress={() => router.back()} style={st.backBtn} hitSlop={10}>
          <MaterialIcons name="arrow-back" size={22} color={S.onSurfaceVariant} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.topTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={st.topSub} numberOfLines={1}>
            ID: {String(vehicleId)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={S.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[st.content, { paddingBottom: insets.bottom + 28 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.primary} />}>
          <View style={st.card}>
            <Text style={st.eyebrow}>Phương tiện</Text>
            <Text style={st.h1}>{vehicle?.plate ?? '—'}</Text>
            <Text style={st.meta}>{vehicle?.name ? vehicle.name : '—'}</Text>
            <View style={st.hr} />
            <View style={st.rowBetween}>
              <View>
                <Text style={st.label}>Tài xế</Text>
                <Text style={st.value}>{assignedLabel}</Text>
              </View>
              <View style={st.actionsRow}>
                <Pressable onPress={() => void openDriverPicker()} style={st.actionBtn}>
                  <MaterialIcons name="person-add" size={18} color={S.primary} />
                  <Text style={st.actionText}>Gán</Text>
                </Pressable>
                <Pressable
                  onPress={() => void onUnassign()}
                  disabled={!isOwner || !(vehicle?.assignedDriver?.id ?? vehicle?.assignedDriverId)}
                  style={({ pressed }) => [
                    st.actionBtn,
                    (!isOwner || !(vehicle?.assignedDriver?.id ?? vehicle?.assignedDriverId)) && st.actionBtnDisabled,
                    pressed && { opacity: 0.9 },
                  ]}>
                  <MaterialIcons name="link-off" size={18} color={S.outline} />
                  <Text style={[st.actionText, { color: S.outline }]}>Bỏ gán</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {driversOpen ? (
            <View style={st.card}>
              <View style={st.rowBetween}>
                <Text style={st.sectionTitle}>Chọn tài xế</Text>
                <Pressable onPress={() => setDriversOpen(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={22} color={S.onSurfaceVariant} />
                </Pressable>
              </View>
              <View style={st.searchRow}>
                <MaterialIcons name="search" size={18} color={S.outline} />
                <TextInput
                  value={driverQuery}
                  onChangeText={setDriverQuery}
                  placeholder="Tìm tên, email, mã…"
                  placeholderTextColor={`${S.outline}99`}
                  style={st.searchInput}
                />
              </View>
              {driversLoading ? (
                <View style={st.centerSmall}>
                  <ActivityIndicator size="small" color={S.primary} />
                </View>
              ) : (
                <FlatList
                  data={displayedDrivers}
                  keyExtractor={(d) => String(d.id)}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => void assignDriver(item.id)}
                      style={({ pressed }) => [st.driverRow, pressed && { opacity: 0.92 }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.driverName} numberOfLines={1}>
                          {displayDriverName(item)}
                        </Text>
                        <Text style={st.driverMeta} numberOfLines={1}>
                          {item.email} · #{String(item.id)}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={S.primary} />
                    </Pressable>
                  )}
                  ListEmptyComponent={<Text style={st.muted}>Không có tài xế khớp tìm kiếm.</Text>}
                />
              )}
            </View>
          ) : null}

          <View style={st.card}>
            <View style={st.rowBetween}>
              <Text style={st.sectionTitle}>Chi phí xe</Text>
              {expensesLoading ? <ActivityIndicator size="small" color={S.primary} /> : null}
            </View>

            <View style={st.expenseTypeRow}>
              {EXPENSE_TYPES.map((t) => {
                const selected = expenseType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setExpenseType(t.value)}
                    style={[st.chip, selected && st.chipSelected]}>
                    <MaterialIcons name={t.icon} size={16} color={selected ? '#fff' : S.onSurfaceVariant} />
                    <Text style={[st.chipText, selected && st.chipTextSelected]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={st.inputRow}>
              <MaterialIcons name="payments" size={18} color={S.outline} />
              <TextInput
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                placeholder="Số tiền (VND)"
                placeholderTextColor={`${S.outline}99`}
                keyboardType="decimal-pad"
                style={st.input}
              />
            </View>
            <View style={st.inputRow}>
              <MaterialIcons name="notes" size={18} color={S.outline} />
              <TextInput
                value={expenseNotes}
                onChangeText={setExpenseNotes}
                placeholder="Ghi chú (tuỳ chọn)"
                placeholderTextColor={`${S.outline}99`}
                style={st.input}
              />
            </View>
            <Pressable
              onPress={() => void onAddExpense()}
              disabled={savingExpense}
              style={({ pressed }) => [st.primaryBtn, (pressed || savingExpense) && { opacity: 0.92 }]}>
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={st.primaryBtnText}>{savingExpense ? 'Đang lưu…' : 'Thêm chi phí'}</Text>
            </Pressable>

            <View style={st.hr} />

            {expenses.length ? (
              expenses.map((e) => (
                <View key={String(e.id)} style={st.expenseRow}>
                  <Text style={st.expenseLeft}>
                    {String(e.expenseType).toUpperCase()} · {formatVnd(e.amount)} VND
                  </Text>
                  <Text style={st.expenseRight}>{e.occurredAt ? new Date(e.occurredAt).toLocaleDateString('vi-VN') : ''}</Text>
                </View>
              ))
            ) : (
              <Text style={st.muted}>Chưa có chi phí.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${S.outlineVariant}33`,
  },
  topTitle: { fontSize: 18, fontWeight: '800', color: Brand.ink },
  topSub: { marginTop: 2, fontSize: 12, color: S.onSurfaceVariant },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${S.outlineVariant}aa`,
  },
  eyebrow: { fontSize: 11, fontWeight: '800', color: S.onSurfaceVariant, letterSpacing: 0.4, textTransform: 'uppercase' },
  h1: { marginTop: 8, fontSize: 24, fontWeight: '900', color: Brand.ink, letterSpacing: -0.4 },
  meta: { marginTop: 4, fontSize: 13, color: S.onSurfaceVariant },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: `${S.outlineVariant}aa`, marginVertical: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { fontSize: 12, color: S.onSurfaceVariant, fontWeight: '700' },
  value: { marginTop: 4, fontSize: 15, fontWeight: '800', color: Brand.ink },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}66`,
    backgroundColor: Brand.surface,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionText: { fontSize: 13, fontWeight: '800', color: S.primary },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: Brand.ink },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}66`,
    marginTop: 12,
    marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: Brand.ink },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${S.outlineVariant}aa`,
  },
  driverName: { fontSize: 14, fontWeight: '900', color: Brand.ink },
  driverMeta: { marginTop: 2, fontSize: 12, color: S.onSurfaceVariant },
  expenseTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: `${S.outlineVariant}22`,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}33`,
  },
  chipSelected: { backgroundColor: S.primary, borderColor: `${S.primary}cc` },
  chipText: { fontSize: 12, fontWeight: '900', color: S.onSurfaceVariant },
  chipTextSelected: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${S.outlineVariant}66`,
    marginTop: 10,
  },
  input: { flex: 1, fontSize: 14, color: Brand.ink },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: S.primary,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  expenseLeft: { fontSize: 13, fontWeight: '800', color: Brand.ink },
  expenseRight: { fontSize: 12, color: S.onSurfaceVariant },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerSmall: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 13, color: S.onSurfaceVariant, textAlign: 'center', paddingVertical: 10 },
});

