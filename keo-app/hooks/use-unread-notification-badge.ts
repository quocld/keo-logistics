import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { getUnreadNotificationSummary } from '@/lib/api/notifications';
import { NOTIFICATION_REFRESH_UNREAD_EVENT } from '@/lib/push/notification-events';

/**
 * Badge text cho icon chuông: số chưa đọc, hoặc "99+" nếu còn nhiều hơn một trang đếm.
 * `null` = không hiện badge (0 hoặc lỗi).
 */
export function useUnreadNotificationBadge() {
  const [badgeText, setBadgeText] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { count, hasMore } = await getUnreadNotificationSummary();
      if (count === 0) {
        setBadgeText(null);
        return;
      }
      setBadgeText(hasMore ? '99+' : String(count));
    } catch {
      setBadgeText(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NOTIFICATION_REFRESH_UNREAD_EVENT, () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { badgeText, refresh };
}
