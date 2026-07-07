import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiRequest, apiRequestBlob } from '../../lib/api/client';
import type {
  BranchDocumentTemplate,
  BranchDocumentInstance,
  CreateBranchDocumentInstanceInput,
  UpdateBranchDocumentInstanceInput,
} from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Raw API
// ---------------------------------------------------------------------------

const branchDocumentsApi = {
  listTemplates: (branchId: string) =>
    apiRequest<BranchDocumentTemplate[]>(`/branches/${branchId}/document-templates`),

  list: (nominationId: string) =>
    apiRequest<BranchDocumentInstance[]>(`/nominations/${nominationId}/branch-documents`),

  create: (nominationId: string, body: CreateBranchDocumentInstanceInput) =>
    apiRequest<BranchDocumentInstance>(`/nominations/${nominationId}/branch-documents`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (nominationId: string, instanceId: string, body: UpdateBranchDocumentInstanceInput) =>
    apiRequest<BranchDocumentInstance>(
      `/nominations/${nominationId}/branch-documents/${instanceId}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),

  finalize: (nominationId: string, instanceId: string) =>
    apiRequest<BranchDocumentInstance>(
      `/nominations/${nominationId}/branch-documents/${instanceId}/finalize`,
      { method: 'POST' },
    ),

  generatePdf: (nominationId: string, instanceId: string) =>
    apiRequest<{ minioKey: string }>(
      `/nominations/${nominationId}/branch-documents/${instanceId}/generate-pdf`,
      { method: 'POST' },
    ),

  downloadPdf: (nominationId: string, instanceId: string) =>
    apiRequestBlob(`/nominations/${nominationId}/branch-documents/${instanceId}/download`),

  delete: (nominationId: string, instanceId: string) =>
    apiRequest<void>(`/nominations/${nominationId}/branch-documents/${instanceId}`, {
      method: 'DELETE',
    }),
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const branchDocKeys = {
  templates: (branchId: string) => ['branch', branchId, 'document-templates'] as const,
  list: (nominationId: string) => ['nomination', nominationId, 'branch-documents'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBranchDocumentTemplates(branchId: string | null | undefined) {
  return useQuery({
    queryKey: branchDocKeys.templates(branchId ?? ''),
    queryFn: () => branchDocumentsApi.listTemplates(branchId!),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });
}

export function useBranchDocuments(nominationId: string) {
  return useQuery({
    queryKey: branchDocKeys.list(nominationId),
    queryFn: () => branchDocumentsApi.list(nominationId),
    enabled: Boolean(nominationId),
    staleTime: 30_000,
  });
}

export function useCreateBranchDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBranchDocumentInstanceInput) =>
      branchDocumentsApi.create(nominationId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: branchDocKeys.list(nominationId) });
      notifications.show({ color: 'green', message: 'Document created' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to create document' }),
  });
}

export function useUpdateBranchDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instanceId,
      body,
    }: {
      instanceId: string;
      body: UpdateBranchDocumentInstanceInput;
    }) => branchDocumentsApi.update(nominationId, instanceId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: branchDocKeys.list(nominationId) });
      notifications.show({ color: 'green', message: 'Document saved' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to save document' }),
  });
}

export function useFinalizeBranchDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => branchDocumentsApi.finalize(nominationId, instanceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: branchDocKeys.list(nominationId) });
      notifications.show({ color: 'teal', message: 'Document finalized' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to finalize document' }),
  });
}

export function useGenerateBranchDocumentPdf(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => branchDocumentsApi.generatePdf(nominationId, instanceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: branchDocKeys.list(nominationId) });
      notifications.show({ color: 'green', message: 'PDF generated' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to generate PDF' }),
  });
}

export function useOpenBranchDocumentPdf(nominationId: string) {
  return useMutation({
    mutationFn: (instanceId: string) => branchDocumentsApi.downloadPdf(nominationId, instanceId),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to open PDF' }),
  });
}

export function useDeleteBranchDocument(nominationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => branchDocumentsApi.delete(nominationId, instanceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: branchDocKeys.list(nominationId) });
      notifications.show({ color: 'orange', message: 'Document deleted' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to delete document' }),
  });
}
