import { apiRequest } from '../../../lib/api/client';
import type { AttachmentUploadResponse } from '@portlog/schemas';
export interface StoredFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}
export interface RecapRecord {
  id: string;
  source: string;
  type: string;
  subject: string;
  sentAt: string;
  canCreatePdf: boolean;
  attachments: StoredFile[];
}
export const terminalFiles = (portId: string) =>
  apiRequest<StoredFile[]>(`/master-data/ports/${portId}/prearrival-documents`);
export const fileAtTerminal = (portId: string, id: string) =>
  apiRequest<StoredFile[]>(`/master-data/ports/${portId}/prearrival-documents/${id}`, {
    method: 'POST',
  });
export const retireTerminalFile = (portId: string, id: string) =>
  apiRequest<StoredFile[]>(`/master-data/ports/${portId}/prearrival-documents/${id}`, {
    method: 'DELETE',
  });
export const prearrivalFiles = (id: string) =>
  apiRequest<{ terminal: { id: string; name: string } | null; files: StoredFile[] }>(
    `/nominations/${id}/prearrival-documents`,
  );
export const recapFiles = (id: string) =>
  apiRequest<RecapRecord[]>(`/nominations/${id}/recap-documents`);
export const recapPdf = (id: string, record: RecapRecord) =>
  apiRequest<AttachmentUploadResponse>(
    `/nominations/${id}/recap-documents/${record.source}/${record.id}/pdf`,
    { method: 'POST' },
  );
