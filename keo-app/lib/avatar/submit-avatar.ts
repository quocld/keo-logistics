import type { PatchAuthMePayload } from '@/lib/auth/types';
import type { AvatarPickerValue } from '@/lib/avatar/picker-value';
import { uploadOpsFile } from '@/lib/api/files';
import { normalizePickedImageForUpload } from '@/lib/images/normalize-picked-image';

/**
 * Payload gửi PATCH /auth/me, PATCH /users/:id, PATCH /owner/drivers/:id.
 * `null` = không đổi (custom nhưng chưa chọn ảnh mới).
 */
export async function buildAvatarUpdatePayload(
  value: AvatarPickerValue,
): Promise<PatchAuthMePayload | null> {
  if (value.mode === 'preset') {
    return { isCustomAvatar: false, appAvatar: value.appAvatarKey };
  }
  if (!value.pendingFile) {
    return null;
  }
  const norm = await normalizePickedImageForUpload({ uri: value.pendingFile.uri });
  const id = await uploadOpsFile({
    uri: norm.uri,
    name: norm.name,
    mimeType: norm.mimeType,
  });
  return { isCustomAvatar: true, photo: { id }, appAvatar: null };
}
