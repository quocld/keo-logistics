import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/auth-context';

export default function AdminNoticeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, user } = useAuth();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Quản trị hệ thống</Text>
      <Text style={styles.body}>
        Tài khoản Admin ({user?.email}) phù hợp với bảng điều khiển web đầy đủ. Ứng dụng di động KeoTram Ops
        tập trung tài xế và chủ xe.
      </Text>
      <Text style={styles.hint}>
        Bạn vẫn có thể đăng xuất tại đây. Để quản lý user và master data, hãy dùng Admin Dashboard trên trình
        duyệt.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/driver/form')}
        style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.92 }]}>
        <Text style={styles.secondaryButtonText}>Tạo tài khoản tài xế</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => signOut().then(() => router.replace('/(auth)/login'))}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]}>
        <Text style={styles.buttonText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.surface,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: Brand.inkMuted,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    lineHeight: 22,
    color: Brand.metallicDeep,
    marginBottom: 24,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: Brand.forest,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: Brand.forest,
    fontSize: 16,
    fontWeight: '700',
  },
  button: {
    backgroundColor: Brand.forest,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
