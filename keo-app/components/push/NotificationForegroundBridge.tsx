import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';

import { NOTIFICATION_REFRESH_UNREAD_EVENT } from '@/lib/push/notification-events';

const RECEIPT_TYPES = new Set(['receipt_created', 'receipt_approved', 'receipt_rejected']);

/**
 * Khi server gửi push:
 * - App foreground: emit event để refetch badge/inbox.
 * - User tap notification (foreground hoặc background): navigate đến màn phiếu cân nếu có receiptId.
 */
export function NotificationForegroundBridge() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    // Foreground: nhận push → refresh badge
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      DeviceEventEmitter.emit(NOTIFICATION_REFRESH_UNREAD_EVENT);
    });

    // Tap notification (từ OS banner hoặc notification center) → deep link
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const type = data?.type as string | undefined;
      const receiptId = data?.receiptId as string | undefined;
      if (receiptId && type && RECEIPT_TYPES.has(type)) {
        router.push(`/(app)/receipt/${receiptId}`);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  return null;
}
