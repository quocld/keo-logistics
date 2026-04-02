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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/brand';
import { Images } from '@/constants/images';
import { getPostLoginPath, useAuth } from '@/contexts/auth-context';
import { getErrorMessage } from '@/lib/api/errors';
import { forgotPasswordApi } from '@/lib/auth/api';

/** Intrinsic size of `assets/images/keotram-login-hero.png`. */
const KEO_TRAM_LOGIN_HERO_ASPECT = 1076 / 992;

export default function LoginScreen() {
  const { width: windowWidth } = useWindowDimensions();
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

  const horizontalPad = 28;
  const logoMaxW = Math.min(windowWidth - horizontalPad * 2, 340);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 28),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={Images.keoTramLoginHero}
            style={[styles.logoImg, { width: logoMaxW, aspectRatio: KEO_TRAM_LOGIN_HERO_ASPECT }]}
            contentFit="contain"
            accessibilityLabel="KEO TRÀM, ứng dụng lâm nghiệp"
          />
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
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImg: {
    maxWidth: '100%',
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
});
