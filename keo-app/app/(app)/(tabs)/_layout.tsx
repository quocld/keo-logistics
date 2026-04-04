import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="harvest-areas"
        options={{
          title: 'Khu',
          href: isOwner ? undefined : null,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="leaf.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="receipt-approval"
        options={{
          title: 'Phiếu',
          href: isOwner ? undefined : null,
          tabBarIcon: ({ color }) => <MaterialIcons name="receipt-long" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Cài đặt',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />

      {/* Hidden from bottom bar — opened via Home icon menu */}
      <Tabs.Screen name="weighing-stations" options={{ href: null }} />
      <Tabs.Screen name="drivers" options={{ href: null }} />
      <Tabs.Screen name="vehicles" options={{ href: null }} />
      <Tabs.Screen name="driver-trip" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
