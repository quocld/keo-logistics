import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import {
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
import { stitchHarvestFormStyles as styles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { createVehicle } from '@/lib/api/vehicles';

const S = Brand.stitch;

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
        autoCapitalize="characters"
        style={styles.fieldIconInput}
      />
    </View>
  );
}

export default function VehicleCreateFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const isOwner = user?.role === 'owner';
  const canUseForm = Boolean(user && isOwner);

  const [plate, setPlate] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && !canUseForm) {
      router.back();
    }
  }, [user, canUseForm, router]);

  const onSubmit = useCallback(async () => {
    const p = plate.trim().toUpperCase();
    if (!p) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập biển số xe.');
      return;
    }
    setSaving(true);
    try {
      await createVehicle({ plate: p, name: name.trim() || null });
      Alert.alert('Đã tạo phương tiện', 'Xe mới đã được thêm vào đội xe.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tạo được phương tiện'));
    } finally {
      setSaving(false);
    }
  }, [plate, name, router]);

  if (!user || !canUseForm) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 32 }]}>
        <Text style={{ fontSize: 15, color: S.onSurfaceVariant, textAlign: 'center', lineHeight: 22 }}>
          Chỉ chủ thầu (Owner) mới tạo được phương tiện.
        </Text>
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
          <MaterialIcons name="directions-car" size={22} color={Brand.forest} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Thêm Phương Tiện
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.helpBtn}
            hitSlop={8}
            onPress={() => Alert.alert('Hỗ trợ', 'API: POST /vehicles (owner).')}>
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
          <Text style={styles.sectionEyebrow}>Thông tin phương tiện</Text>
          <Text style={styles.fieldApiHint}>
            API: <Text style={styles.fieldApiMono}>POST /vehicles</Text>
          </Text>

          <FormFieldLabel required>Biển số</FormFieldLabel>
          <FieldIconInput icon="confirmation-number" value={plate} onChangeText={setPlate} placeholder="51A-123.45" />

          <FormFieldLabel>Dòng xe / tên xe</FormFieldLabel>
          <View style={styles.fieldIconRow}>
            <MaterialIcons name="badge" size={20} color={`${S.outline}99`} style={styles.fieldIcon} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ví dụ: Howo A7 / Xe mooc…"
              placeholderTextColor={`${S.outline}80`}
              style={styles.fieldIconInput}
            />
          </View>
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
            <MaterialIcons name="save" size={22} color="#fff" />
            <Text style={styles.saveText}>{saving ? 'Đang tạo…' : 'Tạo phương tiện'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Hủy bỏ và quay lại</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const local = StyleSheet.create({
  mono: { fontVariant: ['tabular-nums'] },
});

