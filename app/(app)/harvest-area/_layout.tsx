import { Stack } from 'expo-router';

import { Brand } from '@/constants/brand';

const S = Brand.stitch;

export default function HarvestAreaStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Quay lại',
        headerTintColor: S.primary,
        headerStyle: { backgroundColor: Brand.canvas },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="[id]" options={{ title: 'Chi tiết khu' }} />
      <Stack.Screen name="form" options={{ headerShown: false }} />
    </Stack>
  );
}
