import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DriverTripProvider } from '@/contexts/driver-trip-context';
import { useAuth } from '@/contexts/auth-context';

export default function AppGroupLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const onAdminNotice = (segments as string[]).includes('admin-notice');
  if (user.role === 'admin' && !onAdminNotice) {
    return <Redirect href="/(app)/admin-notice" />;
  }

  return (
    <DriverTripProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin-notice" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="weighing-stations-map" options={{ headerShown: false }} />
        <Stack.Screen name="driver-tracking-map" options={{ headerShown: false }} />
      </Stack>
    </DriverTripProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
