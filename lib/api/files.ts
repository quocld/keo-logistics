import { File as ExpoFile } from 'expo-file-system';

import { getOpsFileUploadMode } from '@/lib/config';

import { apiFetch } from './client';
import { formatApiErrorFromJsonText, formatApiErrorPayload } from './errors';

export type UploadFileResponse = {
  file?: { id?: string; path?: string };
  uploadSignedUrl?: string;
  message?: string;
};

const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif'] as const;

function extensionFromMime(mimeType: string): string | null {
  const m = mimeType.toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'image/gif') return '.gif';
  return null;
}

/** Postman / backend: chỉ jpg/jpeg/png/gif. */
function ensureOpsUploadFileName(name: string, mimeType: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  if (ext === '.heic' || ext === '.heif' || /heic|heif/i.test(mimeType)) {
    throw new Error(
      'Ảnh HEIC/HEIF chưa được hỗ trợ. Chọn JPG hoặc PNG trong thư viện (hoặc bật “Most Compatible” trong Camera).',
    );
  }
  if ((ALLOWED_IMAGE_EXT as readonly string[]).includes(ext)) {
    return name;
  }
  const fallback = extensionFromMime(mimeType);
  if (!fallback) {
    throw new Error('Chỉ hỗ trợ ảnh jpg, png, gif');
  }
  const base = dot >= 0 ? name.slice(0, dot) : name;
  return `${base || 'upload'}${fallback}`;
}

async function getLocalFileSizeAndBytes(uri: string): Promise<{
  size: number;
  bytes: Uint8Array;
}> {
  const f = new ExpoFile(uri);
  if (!f.exists) {
    throw new Error('Không đọc được file ảnh');
  }
  const info = f.info();
  const size = info.size;
  if (size == null) {
    throw new Error('Không lấy được kích thước file');
  }
  const bytes = await f.bytes();
  if (bytes.byteLength !== size) {
    throw new Error(`Kích thước file không khớp (${bytes.byteLength} ≠ ${size})`);
  }
  return { size, bytes };
}

function parseUploadResponse(text: string, res: Response): UploadFileResponse {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as UploadFileResponse;
  } catch {
    throw new Error(formatApiErrorFromJsonText(text, res.statusText, res.status));
  }
}

/**
 * Presigned (FILE_DRIVER=s3-presigned): POST JSON → PUT S3. Không gửi Bearer lên S3.
 * Nếu backend ký thêm header (vd. Content-Type), cần khớp ở đây.
 * Expo web: bucket S3 cần CORS cho PUT từ origin của bạn.
 */
async function uploadOpsFilePresigned(params: {
  uri: string;
  name: string;
  mimeType: string;
}): Promise<string> {
  const fileName = ensureOpsUploadFileName(params.name, params.mimeType);
  const { size: fileSize, bytes } = await getLocalFileSizeAndBytes(params.uri);

  const res = await apiFetch('/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileSize }),
  });

  const text = await res.text();
  const data = parseUploadResponse(text, res);

  if (!res.ok) {
    const detail = formatApiErrorPayload(data, res.statusText, res.status);
    throw new Error(
      `${detail}\n\nNếu API chỉ hỗ trợ multipart, đặt EXPO_PUBLIC_OPS_FILE_UPLOAD=multipart hoặc xóa biến.`,
    );
  }

  const id = data.file?.id;
  const uploadSignedUrl = data.uploadSignedUrl;
  if (!id) {
    throw new Error('Upload không trả file.id');
  }
  if (!uploadSignedUrl) {
    throw new Error(
      'Server không trả uploadSignedUrl. Kiểm tra FILE_DRIVER=s3-presigned và EXPO_PUBLIC_OPS_FILE_UPLOAD.',
    );
  }

  const putRes = await fetch(uploadSignedUrl, {
    method: 'PUT',
    // RN / TS BodyInit typing is narrower than runtime; bytes length must match presigned Content-Length.
    body: bytes as unknown as NonNullable<RequestInit['body']>,
  });
  if (!putRes.ok) {
    const hint = await putRes.text().catch(() => '');
    const detail = hint.trim()
      ? formatApiErrorFromJsonText(hint, putRes.statusText, putRes.status)
      : `[${putRes.status}] ${putRes.statusText}`;
    throw new Error(`Không upload được lên storage.\n${detail}`);
  }

  return id;
}

async function uploadOpsFileMultipart(params: {
  uri: string;
  name: string;
  mimeType: string;
}): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri: params.uri,
    name: params.name,
    type: params.mimeType,
  } as unknown as Blob);

  const res = await apiFetch('/files/upload', {
    method: 'POST',
    body: formData,
  });

  const text = await res.text();
  const data = parseUploadResponse(text, res);

  if (!res.ok) {
    throw new Error(formatApiErrorPayload(data, res.statusText, res.status));
  }

  const id = data.file?.id;
  if (!id) {
    throw new Error('Upload không trả file.id');
  }
  return id;
}

/**
 * POST /files/upload — theo `EXPO_PUBLIC_OPS_FILE_UPLOAD`:
 * - `presigned`: JSON fileName + fileSize → uploadSignedUrl → PUT binary (Postman Files).
 * - mặc định / `multipart`: multipart như FILE_DRIVER=local|s3.
 */
export async function uploadOpsFile(params: {
  uri: string;
  name: string;
  mimeType: string;
}): Promise<string> {
  const mode = getOpsFileUploadMode();
  return mode === 'presigned' ? uploadOpsFilePresigned(params) : uploadOpsFileMultipart(params);
}
