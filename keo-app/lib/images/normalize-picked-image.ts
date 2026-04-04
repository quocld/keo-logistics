import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_EDGE_PX = 1920;
const JPEG_COMPRESS = 0.8;

export type NormalizedPickedImage = {
  uri: string;
  name: string;
  mimeType: string;
};

/**
 * Chuẩn hóa ảnh (HEIC/JPEG/PNG/…) → JPEG trước upload Ops API (jpg/png/gif).
 * Chỉ resize khi cạnh ngang ảnh gốc > MAX_EDGE_PX (tránh upscale ảnh nhỏ).
 */
export async function normalizePickedImageForUpload(input: {
  uri: string;
  index?: number;
  /** Từ ImagePicker asset; 0 = không biết → vẫn resize theo max width */
  width?: number;
}): Promise<NormalizedPickedImage> {
  const idx = input.index ?? 0;
  const actions =
    input.width != null && input.width > 0 && input.width <= MAX_EDGE_PX
      ? []
      : [{ resize: { width: MAX_EDGE_PX } as const }];

  try {
    const result = await manipulateAsync(input.uri, actions, {
      compress: JPEG_COMPRESS,
      format: SaveFormat.JPEG,
    });
    return {
      uri: result.uri,
      name: `receipt-${Date.now()}-${idx}.jpg`,
      mimeType: 'image/jpeg',
    };
  } catch {
    throw new Error('Không xử lý được ảnh. Thử chọn ảnh khác hoặc định dạng JPG/PNG.');
  }
}
