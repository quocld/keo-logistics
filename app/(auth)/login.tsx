import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { Images } from '@/constants/images';
import { getPostLoginPath, useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { forgotPasswordApi } from '@/lib/auth/api';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await signIn(email.trim(), password);
      router.replace(getPostLoginPath(user.role));
    } catch (e) {
      Alert.alert('Đăng nhập thất bại', getErrorMessage(e, 'Đăng nhập thất bại'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Email', 'Nhập email vào ô phía trên rồi chọn Quên mật khẩu.');
      return;
    }
    setForgotSending(true);
    try {
      await forgotPasswordApi(email.trim());
      Alert.alert('Đã gửi', 'Kiểm tra hộp thư để đặt lại mật khẩu (nếu tài khoản tồn tại).');
    } catch (e) {
      Alert.alert('Lỗi', getErrorMessage(e, 'Không gửi được yêu cầu'));
    } finally {
      setForgotSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoCard}>
            <Image source={Images.keoTramLogo} style={styles.logoImg} contentFit="contain" />
          </View>
          <Text style={styles.wordmark}>KeoTram</Text>
          <Text style={styles.tagline}>Vận tải gỗ · Logistics chuyên nghiệp</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Đăng nhập KeoTram Ops</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="ten@congty.vn"
            placeholderTextColor={Brand.metallicDeep}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>Mật khẩu</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Brand.metallicDeep}
            secureTextEntry
            editable={!submitting}
            style={styles.input}
            onSubmitEditing={onSubmit}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quên mật khẩu"
            disabled={forgotSending || submitting}
            onPress={onForgotPassword}
            style={styles.forgotWrap}>
            <Text style={styles.forgot}>{forgotSending ? 'Đang gửi…' : 'Quên mật khẩu?'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={onSubmit}
            style={({ pressed }) => [styles.ctaOuter, (pressed || submitting) && { opacity: 0.92 }]}>
            <LinearGradient
              colors={[Brand.forest, Brand.emerald]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>Đăng nhập</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Một tài khoản cho tài xế, chủ xe và quản trị. Đăng nhập bằng email và mật khẩu do quản trị cấp.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Brand.surface,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCard: {
    backgroundColor: Brand.surface,
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 16,
    shadowColor: Brand.forest,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  logoImg: {
    width: 108,
    height: 108,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Brand.ink,
  },
  tagline: {
    marginTop: 6,
    fontSize: 15,
    color: Brand.inkMuted,
    textAlign: 'center',
  },
  pill: {
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.surfaceQuiet,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.forest,
    letterSpacing: 0.2,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.ink,
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 18,
  },
  input: {
    backgroundColor: Brand.surfaceQuiet,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 16,
    color: Brand.ink,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 22,
  },
  forgot: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.forest,
  },
  ctaOuter: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Brand.forest,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  cta: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 28,
    fontSize: 13,
    lineHeight: 20,
    color: Brand.inkMuted,
    textAlign: 'center',
  },
});
