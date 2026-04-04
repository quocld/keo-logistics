import { Image } from 'expo-image';

/**
 * Ảnh phiếu xem lặp (list → chi tiết → lightbox): ưu tiên RAM + disk.
 * Mặc định expo-image chỉ `disk`; `memory-disk` giảm tải lại khi quay lại màn.
 */
export const RECEIPT_IMAGE_CACHE_POLICY = 'memory-disk' as const;

/**
 * Prefetch URL (sau khi có danh sách từ API) để hero/thumbnail/lightbox hit cache.
 * Bỏ qua lỗi mạng — không throw.
 */
export async function prefetchReceiptImages(urls: string[]): Promise<boolean> {
  const uniq = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (uniq.length === 0) return true;
  try {
    return await Image.prefetch(uniq, RECEIPT_IMAGE_CACHE_POLICY);
  } catch {
    return false;
  }
}
