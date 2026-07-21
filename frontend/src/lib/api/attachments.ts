import { apiRequest, apiUpload } from './client';
import { attachmentUploadResponseSchema, type AttachmentUploadResponse } from '@portlog/schemas';

/** Upload a single file as multipart/form-data; returns its stored metadata + id. */
export async function uploadAttachment(file: File): Promise<AttachmentUploadResponse> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const raw = await apiUpload<unknown>('/attachments', fd);
  return attachmentUploadResponseSchema.parse(raw);
}

/** Delete a staged (not-yet-sent) attachment. */
export function deleteAttachment(id: string): Promise<void> {
  return apiRequest<void>(`/attachments/${id}`, { method: 'DELETE' });
}
