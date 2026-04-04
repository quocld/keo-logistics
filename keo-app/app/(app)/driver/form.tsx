import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
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
import { AvatarPickerSection, defaultAvatarPickerValue } from '@/components/profile/AvatarPickerSection';
import { stitchHarvestFormStyles as styles } from '@/components/owner/stitch-harvest-form-styles';
import { Brand } from '@/constants/brand';
import { getDefaultUserStatusId, getDriverRoleId } from '@/constants/ops-roles';
import { useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { appendHarvestAreaForOwnerDriver, createOwnerDriver, updateOwnerDriver } from '@/lib/api/owner-drivers';
import { createUser, updateUser } from '@/lib/api/users';
import type { AvatarPickerValue } from '@/lib/avatar/picker-value';
import { buildAvatarUpdatePayload } from '@/lib/avatar/submit-avatar';

const S = Brand.stitch;

const MIN_PASSWORD_LEN = 8;

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function FieldIconInput({
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
}: {
  icon: IconName;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad' | 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
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
        secureTextEntry={secureTextEntry}
        style={styles.fieldIconInput}
      />
    </View>
  );
}

export default function DriverCreateFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { harvestAreaId: harvestAreaIdParam, harvestAreaName: harvestAreaNameParam } =
    useLocalSearchParams<{
      harvestAreaId?: string | string[];
      harvestAreaName?: string | string[];
    }>();
  const harvestAreaId =
    typeof harvestAreaIdParam === 'string'
      ? harvestAreaIdParam
      : harvestAreaIdParam?.[0];
  const harvestAreaName =
    typeof harvestAreaNameParam === 'string'
      ? harvestAreaNameParam
      : harvestAreaNameParam?.[0];

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.role === 'owner';
  const canUseForm = isAdmin || isOwner;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatar, setAvatar] = useState<AvatarPickerValue>(() => defaultAvatarPickerValue());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && !canUseForm) {
      router.back();
    }
  }, [user, canUseForm, router]);

  const successMessage = useMemo(() => {
    if (isOwner) {
      if (harvestAreaId) {
        return 'Tài xế đã được gán vào khu vừa chọn. Họ có thể đăng nhập app và tạo chuyến khi đã có bãi (harvest areas) gán.';
      }
      return 'Tài xế có thể đăng nhập app. Danh sách tab Tài xế (gom từ chuyến) sẽ có họ sau khi có trip gắn tài khoản này.';
    }
    return 'Tài xế có thể đăng nhập app. Tab Owner vẫn gom tài xế từ GET /trips sau khi có chuyến.';
  }, [isOwner, harvestAreaId]);

  const onSubmit = useCallback(async () => {
    const em = email.trim();
    if (!em) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email.');
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      Alert.alert('Thiếu thông tin', `Mật khẩu cần ít nhất ${MIN_PASSWORD_LEN} ký tự.`);
      return;
    }
    if (avatar.mode === 'custom' && !avatar.pendingFile) {
      Alert.alert(
        'Thiếu ảnh',
        'Bạn chọn «Ảnh từ máy» nhưng chưa chọn ảnh. Chọn ảnh từ thư viện hoặc chuyển sang «Trong app».',
      );
      return;
    }

    setSaving(true);
    try {
      if (isOwner) {
        const created = await createOwnerDriver({
          email: em,
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          status: { id: getDefaultUserStatusId() },
        });
        if (harvestAreaId) {
          await appendHarvestAreaForOwnerDriver(created.id, harvestAreaId);
        }
        const avatarPayload = await buildAvatarUpdatePayload(avatar);
        if (avatarPayload) {
          await updateOwnerDriver(created.id, avatarPayload);
        }
      } else if (isAdmin) {
        const createdRaw = await createUser({
          email: em,
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          role: { id: getDriverRoleId() },
          status: { id: getDefaultUserStatusId() },
        });
        let newId: number | null = null;
        if (createdRaw && typeof createdRaw === 'object' && 'id' in createdRaw) {
          const raw = (createdRaw as { id: unknown }).id;
          if (typeof raw === 'number' && Number.isFinite(raw)) newId = raw;
          else if (typeof raw === 'string') {
            const n = Number(raw);
            if (Number.isFinite(n)) newId = n;
          }
        }
        if (newId != null) {
          const avatarPayload = await buildAvatarUpdatePayload(avatar);
          if (avatarPayload) {
            await updateUser(newId, avatarPayload);
          }
        }
      } else {
        return;
      }
      Alert.alert('Đã tạo tài khoản', successMessage, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không tạo được tài khoản'));
    } finally {
      setSaving(false);
    }
  }, [
    email,
    password,
    firstName,
    lastName,
    avatar,
    isAdmin,
    isOwner,
    router,
    successMessage,
    harvestAreaId,
  ]);

  if (!user || !canUseForm) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 32 }]}>
        <Text style={{ fontSize: 15, color: S.onSurfaceVariant, textAlign: 'center', lineHeight: 22 }}>
          Chỉ chủ thầu (Owner) hoặc quản trị viên (Admin) mới tạo được tài khoản tài xế.
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
          <MaterialIcons name="add-circle" size={22} color={Brand.forest} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Thêm Tài Xế Mới
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
            onPress={() =>
              Alert.alert(
                'Hỗ trợ',
                isOwner
                  ? 'Owner: POST /owner/drivers. Admin: POST /users với role driver.'
                  : 'Admin: POST /users — role.id driver, có thể thêm managedByOwnerId trong Postman.',
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
          <Text style={styles.sectionEyebrow}>Thông tin tài khoản</Text>
          {isOwner && harvestAreaId ? (
            <View style={styles.harvestLinkBanner}>
              <MaterialIcons name="eco" size={18} color={S.primary} />
              <Text style={styles.harvestLinkBannerText}>
                Sau khi tạo, tài xế sẽ được gán khu
                {harvestAreaName ? ` «${harvestAreaName}»` : ''}.
              </Text>
            </View>
          ) : null}
          <Text style={styles.fieldApiHint}>
            {isOwner ? (
              <>
                API: <Text style={styles.fieldApiMono}>POST /owner/drivers</Text> ·{' '}
                <Text style={styles.fieldApiMono}>status.id = {getDefaultUserStatusId()}</Text>
              </>
            ) : (
              <>
                API: <Text style={styles.fieldApiMono}>POST /users</Text> ·{' '}
                <Text style={styles.fieldApiMono}>role.id = {getDriverRoleId()}</Text>
              </>
            )}
          </Text>

          <FormFieldLabel required>Email</FormFieldLabel>
          <FieldIconInput
            icon="email"
            value={email}
            onChangeText={setEmail}
            placeholder="tai.xe@example.com"
            keyboardType="email-address"
          />

          <FormFieldLabel required>Mật khẩu</FormFieldLabel>
          <FieldIconInput
            icon="lock"
            value={password}
            onChangeText={setPassword}
            placeholder={`Tối thiểu ${MIN_PASSWORD_LEN} ký tự`}
            secureTextEntry
          />

          <View style={styles.twoCol}>
            <View style={styles.colHalf}>
              <FormFieldLabel>Họ</FormFieldLabel>
              <FieldIconInput icon="account-box" value={lastName} onChangeText={setLastName} placeholder="Nguyễn" />
            </View>
            <View style={styles.colHalf}>
              <FormFieldLabel>Tên</FormFieldLabel>
              <FieldIconInput icon="person" value={firstName} onChangeText={setFirstName} placeholder="Văn A" />
            </View>
          </View>

          <AvatarPickerSection value={avatar} onChange={setAvatar} />
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <Text style={styles.sectionEyebrowMap}>Vận hành</Text>
            <View style={styles.gpsPill}>
              <Text style={styles.gpsPillText}>DRIVER</Text>
            </View>
          </View>
          <View style={styles.mapVisual}>
            <LinearGradient
              colors={['#e8f5e9', S.surfaceContainerLow, '#c8e6c9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.mapPinWrap}>
              <MaterialIcons name="local-shipping" size={36} color={S.primary} />
            </View>
          </View>
          <Text style={[styles.fieldApiHint, { marginTop: 12, marginBottom: 0 }]}>
            Sau khi tạo tài khoản, tài xế đăng nhập app để tạo chuyến (trips). Danh sách tài xế trên tab Owner gom từ{' '}
            <Text style={styles.fieldApiMono}>GET /trips</Text>.
          </Text>
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
            <Text style={styles.saveText}>{saving ? 'Đang tạo…' : 'Tạo tài khoản tài xế'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Hủy bỏ và quay lại</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
