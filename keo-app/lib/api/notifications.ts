import type { NotificationInboxItem, PaginatedList } from '@/lib/types/ops';

import { apiFetchJson } from '@/lib/api/client';

import { buildListQuery } from './list-query';

function mapNotificationRow(raw: unknown): NotificationInboxItem {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const id = r.id != null ? String(r.id) : '';
    const isRead = Boolean(r.isRead ?? r.is_read);
    const title =
      r.title != null
        ? String(r.title)
        : r.subject != null
          ? String(r.subject)
          : null;
    const bodyText =
      r.body != null
        ? String(r.body)
        : r.message != null
          ? String(r.message)
          : r.content != null
            ? String(r.content)
            : null;
    const createdAt =
      r.createdAt != null
        ? String(r.createdAt)
        : r.created_at != null
          ? String(r.created_at)
          : null;
    const readAt =
      r.readAt != null ? String(r.readAt) : r.read_at != null ? String(r.read_at) : null;
    return {
      ...r,
      id,
      isRead,
      title,
      body: bodyText,
      message: r.message != null ? String(r.message) : null,
      createdAt,
      readAt,
    };
  }
  return { id: '', isRead: true };
}

export type ExpoPushPlatform = 'ios' | 'android';

export type RegisterExpoPushBody = {
  expoPushToken: string;
  platform: ExpoPushPlatform;
  enabled: boolean;
  easProjectId?: string;
  easEnvironment?: string;
};

/** Response shape from Nest — extend when backend contract is fixed. */
export type RegisterExpoPushResponse = {
  id?: string;
  expoPushToken?: string;
  platform?: string;
  isEnabled?: boolean;
  userId?: string | number;
  [key: string]: unknown;
};

export async function registerExpoPushDevice(
  body: RegisterExpoPushBody,
): Promise<RegisterExpoPushResponse> {
  return apiFetchJson<RegisterExpoPushResponse>('/notifications/expo/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const UNREAD_BADGE_PAGE_LIMIT = 99;

/** Số thông báo chưa đọc (tối đa một trang); `hasMore` nếu còn trang sau. */
export async function getUnreadNotificationSummary(): Promise<{
  count: number;
  hasMore: boolean;
}> {
  const res = await listNotifications({
    page: 1,
    limit: UNREAD_BADGE_PAGE_LIMIT,
    isRead: false,
  });
  return { count: res.data.length, hasMore: res.hasNextPage };
}

export async function listNotifications(params: {
  page: number;
  limit: number;
  isRead?: boolean;
}): Promise<PaginatedList<NotificationInboxItem>> {
  const extra: Record<string, string | undefined> = {};
  if (params.isRead !== undefined) {
    extra.isRead = params.isRead ? 'true' : 'false';
  }
  const qs = buildListQuery({
    page: params.page,
    limit: params.limit,
    extra: Object.keys(extra).length ? extra : undefined,
  });
  const res = await apiFetchJson<PaginatedList<unknown>>(`/notifications?${qs}`);
  return {
    data: res.data.map(mapNotificationRow),
    hasNextPage: res.hasNextPage,
  };
}

export async function markNotificationRead(id: string): Promise<NotificationInboxItem> {
  const raw = await apiFetchJson<unknown>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
  const mapped = mapNotificationRow(raw);
  if (mapped.id) {
    return mapped;
  }
  return { id, isRead: true };
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetchJson<Record<string, unknown>>('/notifications/read-all', {
    method: 'POST',
  });
}
