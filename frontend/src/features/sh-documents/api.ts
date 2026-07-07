import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiRequest, apiRequestBlob } from '../../lib/api/client';
import type {
  SHDocumentDto,
  CreateSHDocumentInput,
  UpdateSHDocumentInput,
  SendShDocumentInput,
} from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Raw API functions
// ---------------------------------------------------------------------------

const shDocumentsApi = {
  list: (nominationId: string) =>
    apiRequest<SHDocumentDto[]>(`/nominations/${nominationId}/sh-documents`),

  create: (nominationId: string, body: CreateSHDocumentInput) =>
    apiRequest<SHDocumentDto>(`/nominations/${nominationId}/sh-documents`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (nominationId: string, shId: string, body: UpdateSHDocumentInput) =>
    apiRequest<SHDocumentDto>(`/nominations/${nominationId}/sh-documents/${shId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  finalize: (nominationId: string, shId: string) =>
    apiRequest<SHDocumentDto>(`/nominations/${nominationId}/sh-documents/${shId}/finalize`, {
      method: 'POST',
    }),

  generate: (nominationId: string, shId: string) =>
    apiRequest<{ minioKey: string }>(`/nominations/${nominationId}/sh-documents/${shId}/generate`, {
      method: 'POST',
    }),

  downloadPdf: (nominationId: string, shId: string) =>
    apiRequestBlob(`/nominations/${nominationId}/sh-documents/${shId}/download`),

  send: (nominationId: string, shId: string, body: SendShDocumentInput) =>
    apiRequest<{ shDocument: SHDocumentDto; dispatch: unknown }>(
      `/nominations/${nominationId}/sh-documents/${shId}/send`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  delete: (nominationId: string, shId: string) =>
    apiRequest<void>(`/nominations/${nominationId}/sh-documents/${shId}`, {
      method: 'DELETE',
    }),
};

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const shDocumentsKeys = {
  list: (nominationId: string) => ['nomination', nominationId, 'sh-documents'] as const,
  detail: (nominationId: string, shId: string) =>
    ['nomination', nominationId, 'sh-documents', shId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useShDocuments(nominationId: string) {
  return useQuery({
    queryKey: shDocumentsKeys.list(nominationId),
    queryFn: () => shDocumentsApi.list(nominationId),
    enabled: Boolean(nominationId),
    staleTime: 30_000,
  });
}

export function useCreateShDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSHDocumentInput) => shDocumentsApi.create(nominationId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.list(nominationId) });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to create document.',
        color: 'red',
      });
    },
  });
}

export function useUpdateShDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shId, body }: { shId: string; body: UpdateSHDocumentInput }) =>
      shDocumentsApi.update(nominationId, shId, body),
    onSuccess: (_data, { shId }) => {
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.list(nominationId) });
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.detail(nominationId, shId) });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error saving',
        message: err instanceof Error ? err.message : 'Failed to save document.',
        color: 'red',
      });
    },
  });
}

export function useFinalizeShDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shId: string) => shDocumentsApi.finalize(nominationId, shId),
    onSuccess: (_data, shId) => {
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.list(nominationId) });
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.detail(nominationId, shId) });
      notifications.show({
        title: 'Finalized',
        message: 'Document finalized successfully.',
        color: 'yellow',
      });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error finalizing',
        message: err instanceof Error ? err.message : 'Failed to finalize document.',
        color: 'red',
      });
    },
  });
}

export function useGenerateShDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shId: string) => shDocumentsApi.generate(nominationId, shId),
    onSuccess: (_data, shId) => {
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.list(nominationId) });
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.detail(nominationId, shId) });
      notifications.show({
        title: 'PDF generated',
        message: 'The PDF has been generated.',
        color: 'teal',
      });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error generating PDF',
        message: err instanceof Error ? err.message : 'Failed to generate PDF.',
        color: 'red',
      });
    },
  });
}

export function useOpenShDocumentPdf(nominationId: string) {
  return useMutation({
    mutationFn: (shId: string) => shDocumentsApi.downloadPdf(nominationId, shId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to open PDF.',
        color: 'red',
      });
    },
  });
}

export function useSendShDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shId, body }: { shId: string; body: SendShDocumentInput }) =>
      shDocumentsApi.send(nominationId, shId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.list(nominationId) });
      void qc.invalidateQueries({ queryKey: ['nomination', nominationId, 'messages'] });
      notifications.show({
        title: 'Sent',
        message: 'Document sent successfully.',
        color: 'green',
      });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Send failed',
        message: err instanceof Error ? err.message : 'Failed to send document.',
        color: 'red',
      });
    },
  });
}

export function useDeleteShDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shId: string) => shDocumentsApi.delete(nominationId, shId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shDocumentsKeys.list(nominationId) });
      notifications.show({
        title: 'Deleted',
        message: 'Document deleted.',
        color: 'gray',
      });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error deleting',
        message: err instanceof Error ? err.message : 'Failed to delete document.',
        color: 'red',
      });
    },
  });
}
