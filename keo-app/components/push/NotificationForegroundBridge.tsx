import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';

import { NOTIFICATION_REFRESH_UNREAD_EVENT } from '@/lib/push/notification-events';

/**
 * Khi server gửi push, JS vẫn nhận được dù app đang foreground — dùng để đồng bộ badge/inbox
 * (best practice: không chỉ dựa vào banner hệ thống).
 */
export function NotificationForegroundBridge() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const sub = Notifications.addNotificationReceivedListener(() => {
      DeviceEventEmitter.emit(NOTIFICATION_REFRESH_UNREAD_EVENT);
    });
    return () => sub.remove();
  }, []);

  return null;
}
