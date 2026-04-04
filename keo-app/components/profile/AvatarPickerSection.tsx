import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useCallback, useMemo } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { APP_AVATAR_OPTIONS, getAppAvatarSource } from '@/constants/app-avatars';
import { Brand } from '@/constants/brand';
import type { AuthUser } from '@/lib/auth/types';
import type { AvatarPickerValue } from '@/lib/avatar/picker-value';
import { normalizePickedImageForUpload } from '@/lib/images/normalize-picked-image';

const S = Brand.stitch;
const isNative = Platform.OS !== 'web';

export type { AvatarPickerValue } from '@/lib/avatar/picker-value';
export { avatarPickerValueFromUser, defaultAvatarPickerValue } from '@/lib/avatar/picker-value';

type Props = {
  /** Để hiển thị ảnh remote khi đã có avatar upload, chưa chọn ảnh mới. */
  authUser?: AuthUser | null;
  value: AvatarPickerValue;
  onChange: (next: AvatarPickerValue) => void;
};

export function AvatarPickerSection({ authUser, value, onChange }: Props) {
  const presetSource = useMemo(
    () => getAppAvatarSource(value.appAvatarKey) ?? APP_AVATAR_OPTIONS[0]!.source,
    [value.appAvatarKey],
  );

  const previewRemoteUri =
    value.mode === 'custom' && !value.pendingFile && authUser?.isCustomAvatar && authUser.photoUrl
      ? authUser.photoUrl
      : null;

  const pickFromLibrary = useCallback(async () => {
    if (!isNative) {
      Alert.alert('Thiết bị', 'Chọn ảnh từ thư viện chỉ hỗ trợ trên iOS/Android.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần quyền truy cập thư viện ảnh để đặt ảnh đại diện.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.92,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const norm = await normalizePickedImageForUpload({
        uri: a.uri,
        width: a.width,
      });
      onChange({
        mode: 'custom',
        appAvatarKey: value.appAvatarKey,
        pendingFile: {
          uri: norm.uri,
          name: norm.name,
          mimeType: norm.mimeType,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không xử lý được ảnh';
      Alert.alert('Ảnh', msg);
    }
  }, [onChange, value.appAvatarKey]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Ảnh đại diện</Text>
      <Text style={styles.hint}>Chọn avatar có sẵn trong app hoặc ảnh từ thư viện (API: isCustomAvatar + appAvatar / photo).</Text>

      <View style={styles.previewRow}>
        <View style={styles.previewCircle}>
          {value.mode === 'preset' ? (
            <Image source={presetSource} style={styles.previewImg} contentFit="cover" />
          ) : value.pendingFile ? (
            <Image source={{ uri: value.pendingFile.uri }} style={styles.previewImg} contentFit="cover" />
          ) : previewRemoteUri ? (
            <Image source={{ uri: previewRemoteUri }} style={styles.previewImg} contentFit="cover" />
          ) : (
            <MaterialIcons name="person" size={40} color={S.outline} />
          )}
        </View>
        <View style={styles.modeCol}>
          <View style={styles.modeRow}>
            <Pressable
              onPress={() =>
                onChange({
                  mode: 'preset',
                  appAvatarKey: value.appAvatarKey,
                  pendingFile: null,
                })
              }
              style={({ pressed }) => [
                styles.modeChip,
                value.mode === 'preset' && styles.modeChipOn,
                pressed && styles.modeChipPressed,
              ]}>
              <Text style={[styles.modeChipText, value.mode === 'preset' && styles.modeChipTextOn]}>Trong app</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                onChange({
                  mode: 'custom',
                  appAvatarKey: value.appAvatarKey,
                  pendingFile: value.pendingFile,
                })
              }
              style={({ pressed }) => [
                styles.modeChip,
                value.mode === 'custom' && styles.modeChipOn,
                pressed && styles.modeChipPressed,
              ]}>
              <Text style={[styles.modeChipText, value.mode === 'custom' && styles.modeChipTextOn]}>Ảnh từ máy</Text>
            </Pressable>
          </View>
          {value.mode === 'custom' ? (
            <Pressable onPress={() => void pickFromLibrary()} style={styles.pickBtn}>
              <MaterialIcons name="photo-library" size={18} color={S.primary} />
              <Text style={styles.pickBtnText}>Chọn ảnh</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {value.mode === 'preset' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
          {APP_AVATAR_OPTIONS.map((opt) => {
            const selected = value.appAvatarKey === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() =>
                  onChange({
                    mode: 'preset',
                    appAvatarKey: opt.key,
                    pendingFile: null,
                  })
                }
                style={({ pressed }) => [
                  styles.presetRing,
                  selected && styles.presetRingSelected,
                  pressed && { opacity: 0.85 },
                ]}>
                <Image source={opt.source} style={styles.presetImg} contentFit="cover" />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: S.onSurfaceVariant,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hint: {
    fontSize: 12,
    color: `${S.onSurfaceVariant}cc`,
    lineHeight: 17,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  previewCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: S.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: { width: 72, height: 72 },
  modeCol: { flex: 1, gap: 8 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: S.surfaceContainerLow,
    borderWidth: 1,
    borderColor: `${S.outline}55`,
  },
  modeChipOn: {
    backgroundColor: `${S.primary}18`,
    borderColor: S.primary,
  },
  modeChipPressed: { opacity: 0.9 },
  modeChipText: { fontSize: 13, fontWeight: '600', color: S.onSurfaceVariant },
  modeChipTextOn: { color: S.primary },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pickBtnText: { fontSize: 14, fontWeight: '600', color: S.primary },
  presetScroll: { gap: 10, paddingVertical: 4 },
  presetRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetRingSelected: {
    borderColor: S.primary,
  },
  presetImg: { width: 44, height: 44, borderRadius: 22, margin: 2 },
});
