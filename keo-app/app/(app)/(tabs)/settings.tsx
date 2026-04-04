import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AvatarPickerSection,
  avatarPickerValueFromUser,
} from '@/components/profile/AvatarPickerSection';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';
import { patchAuthMe } from '@/lib/api/auth-profile';
import { getErrorMessage } from '@/lib/api/errors';
import { resolveAvatarDisplay } from '@/lib/avatar/resolve-display';
import type { AvatarPickerValue } from '@/lib/avatar/picker-value';
import { defaultAvatarPickerValue } from '@/lib/avatar/picker-value';
import { buildAvatarUpdatePayload } from '@/lib/avatar/submit-avatar';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const [avatar, setAvatar] = useState<AvatarPickerValue>(() => defaultAvatarPickerValue());

  useEffect(() => {
    if (user) {
      setAvatar(avatarPickerValueFromUser(user));
    }
  }, [user?.id, user?.isCustomAvatar, user?.appAvatar, user?.photoUrl]);

  const [savingAvatar, setSavingAvatar] = useState(false);

  const onSaveAvatar = useCallback(async () => {
    const payload = await buildAvatarUpdatePayload(avatar);
    if (!payload) {
      Alert.alert(
        'Chưa có thay đổi',
        'Bạn đang dùng ảnh từ máy nhưng chưa chọn ảnh mới. Chọn ảnh từ thư viện hoặc chuyển sang tab «Trong app».',
      );
      return;
    }
    setSavingAvatar(true);
    try {
      await patchAuthMe(payload);
      await refreshUser();
      Alert.alert('Đã lưu', 'Ảnh đại diện đã cập nhật.');
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không lưu được ảnh đại diện'));
    } finally {
      setSavingAvatar(false);
    }
  }, [avatar, refreshUser]);

  const headerAvatar = user ? resolveAvatarDisplay(user) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Cài đặt</Text>
      {user && (
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              {headerAvatar?.kind === 'remote' ? (
                <Image source={{ uri: headerAvatar.uri }} style={styles.avatarImg} contentFit="cover" />
              ) : headerAvatar?.kind === 'preset' || headerAvatar?.kind === 'fallback' ? (
                <Image source={headerAvatar.source} style={styles.avatarImg} contentFit="cover" />
              ) : null}
            </View>
            <View style={styles.userText}>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
              <Text style={styles.userRole}>{user.role}</Text>
            </View>
          </View>
          <View style={styles.hairline} />
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>
          <Text style={[styles.label, styles.labelSpaced]}>Vai trò</Text>
          <Text style={styles.value}>{user.role}</Text>

          <View style={styles.hairline} />
          <AvatarPickerSection authUser={user} value={avatar} onChange={setAvatar} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void onSaveAvatar()}
            disabled={savingAvatar}
            style={({ pressed }) => [styles.saveAvatarBtn, pressed && { opacity: 0.9 }, savingAvatar && { opacity: 0.65 }]}>
            {savingAvatar ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveAvatarBtnText}>Lưu ảnh đại diện</Text>
            )}
          </Pressable>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => signOut().then(() => router.replace('/(auth)/login'))}
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.surface,
  },
  content: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 24,
  },
  card: {
    backgroundColor: Brand.surfaceQuiet,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Brand.surface,
  },
  avatarImg: { width: 56, height: 56 },
  userText: { flex: 1, minWidth: 0 },
  userEmail: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  userRole: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${Brand.inkMuted}26`,
    marginBottom: 16,
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelSpaced: {
    marginTop: 16,
  },
  value: {
    fontSize: 17,
    color: Brand.ink,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  saveAvatarBtn: {
    marginTop: 8,
    backgroundColor: Brand.forest,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveAvatarBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  logout: {
    backgroundColor: Brand.forest,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
