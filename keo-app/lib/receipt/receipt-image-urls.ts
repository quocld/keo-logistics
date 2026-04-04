import type { Receipt } from '@/lib/types/ops';

/**
 * Nguồn ảnh + khóa cache ổn định (khi backend trả `images[].id`).
 * Dùng với expo-image `cacheKey` để presigned GET đổi URL vẫn tái sử dụng cache khi cùng id.
 */
export type ReceiptImageSource = {
  uri: string;
  cacheKey?: string;
};

/**
 * Backend có thể trả ảnh dạng:
 * - `imageUrls: string[]` (Postman / submit)
 * - `images: { id?, imageUrl, isPrimary? }[]` (GET detail / list)
 * - `receiptImageUrl` (deprecated)
 */
export function collectReceiptImageSources(r: Receipt): ReceiptImageSource[] {
  const out: ReceiptImageSource[] = [];
  const seenUri = new Set<string>();

  const push = (u: string, cacheKey?: string) => {
    const t = u.trim();
    if (!t || seenUri.has(t)) return;
    seenUri.add(t);
    out.push(cacheKey ? { uri: t, cacheKey } : { uri: t });
  };

  const nested = (r as { images?: Array<{ id?: string; imageUrl?: string; isPrimary?: boolean }> }).images;
  if (Array.isArray(nested) && nested.length > 0) {
    const sorted = [...nested].sort((a, b) => {
      if (a?.isPrimary && !b?.isPrimary) return -1;
      if (!a?.isPrimary && b?.isPrimary) return 1;
      return 0;
    });
    for (const img of sorted) {
      if (img && typeof img.imageUrl === 'string' && img.imageUrl) {
        const id = img.id != null && String(img.id).trim() !== '' ? String(img.id) : undefined;
        push(img.imageUrl, id);
      }
    }
  }

  const urls = r.imageUrls;
  if (Array.isArray(urls)) {
    for (const u of urls) {
      if (typeof u === 'string' && u) push(u);
    }
  }

  const legacy = (r as { receiptImageUrl?: string }).receiptImageUrl;
  if (typeof legacy === 'string' && legacy) push(legacy);

  return out;
}

export function collectReceiptImageUrls(r: Receipt): string[] {
  return collectReceiptImageSources(r).map((s) => s.uri);
}

export function firstReceiptImageUrl(r: Receipt): string | null {
  const all = collectReceiptImageUrls(r);
  return all[0] ?? null;
}
