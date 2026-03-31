import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { Images, pickDefaultAvatar } from '@/constants/images';
import { useAuth } from '@/contexts/auth-context';

function defaultAvatarByRole(role: string, userId: number) {
  if (role === 'admin') return Images.keoTramLogo;
  return pickDefaultAvatar(userId);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Cài đặt</Text>
      {user && (
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Image
                source={defaultAvatarByRole(user.role, user.id)}
                style={styles.avatarImg}
                contentFit="cover"
              />
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
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => signOut().then(() => router.replace('/(auth)/login'))}
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}>
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.surface,
    padding: 24,
    paddingTop: 56,
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
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: `${Brand.inkMuted}26`, marginBottom: 16 },
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
