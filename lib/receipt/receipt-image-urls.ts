import type { Receipt } from '@/lib/types/ops';

/**
 * Backend có thể trả ảnh dạng:
 * - `imageUrls: string[]` (Postman / submit)
 * - `images: { imageUrl, isPrimary? }[]` (GET detail / list)
 * - `receiptImageUrl` (deprecated)
 */
export function collectReceiptImageUrls(r: Receipt): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    const t = u.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  const nested = (r as { images?: Array<{ imageUrl?: string; isPrimary?: boolean }> }).images;
  if (Array.isArray(nested) && nested.length > 0) {
    const sorted = [...nested].sort((a, b) => {
      if (a?.isPrimary && !b?.isPrimary) return -1;
      if (!a?.isPrimary && b?.isPrimary) return 1;
      return 0;
    });
    for (const img of sorted) {
      if (img && typeof img.imageUrl === 'string' && img.imageUrl) {
        push(img.imageUrl);
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

export function firstReceiptImageUrl(r: Receipt): string | null {
  const all = collectReceiptImageUrls(r);
  return all[0] ?? null;
}
