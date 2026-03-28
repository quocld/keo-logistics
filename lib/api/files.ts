import { apiFetch } from './client';

export type UploadFileResponse = {
  file?: { id?: string; path?: string };
  message?: string;
};

/**
 * POST /files/upload — multipart, Bearer token (Postman: driver; owner nếu API cho phép).
 * Response: `{ file: { id, path } }`
 */
export async function uploadOpsFile(params: {
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
  let data: UploadFileResponse = {};
  if (text) {
    try {
      data = JSON.parse(text) as UploadFileResponse;
    } catch {
      throw new Error(text.slice(0, 200) || 'Upload failed');
    }
  }

  if (!res.ok) {
    throw new Error(data.message ?? res.statusText);
  }

  const id = data.file?.id;
  if (!id) {
    throw new Error('Upload không trả file.id');
  }
  return id;
}
