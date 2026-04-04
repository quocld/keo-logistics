import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { NotificationForegroundBridge } from '@/components/push/NotificationForegroundBridge';
import { AuthProvider } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

import '@/lib/tracking/location-task';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Foreground: bật banner/để JS nhận notification (addNotificationReceivedListener).
 * Nhiều app khi đang mở sẽ tắt banner OS và chỉ dùng toast + badge — ở đây vẫn cho hiện banner;
 * đồng bộ số badge qua NotificationForegroundBridge + useUnreadNotificationBadge.
 */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(app)/(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="owner-login" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationForegroundBridge />
      <RootLayoutNav />
    </AuthProvider>
  );
}
