import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiRequest } from '../../lib/api/client';
import type {
  BranchDocumentTemplate,
  CreateBranchDocumentTemplateInput,
  UpdateBranchDocumentTemplateInput,
  CreateBranchDocumentTemplateFieldInput,
  UpdateBranchDocumentTemplateFieldInput,
  ReorderTemplateFieldsInput,
  UploadHbsInput,
} from '@portlog/schemas';
import { branchDocKeys } from './api';

// Re-export so consumers can import from one place
export { useBranchDocumentTemplates } from './api';

const base = (branchId: string) => `/branches/${branchId}/document-templates`;
const tplUrl = (branchId: string, templateId: string) => `${base(branchId)}/${templateId}`;

const api = {
  createTemplate: (branchId: string, body: CreateBranchDocumentTemplateInput) =>
    apiRequest<BranchDocumentTemplate>(base(branchId), {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTemplate: (branchId: string, templateId: string, body: UpdateBranchDocumentTemplateInput) =>
    apiRequest<BranchDocumentTemplate>(tplUrl(branchId, templateId), {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteTemplate: (branchId: string, templateId: string) =>
    apiRequest<void>(tplUrl(branchId, templateId), { method: 'DELETE' }),

  uploadHbs: (branchId: string, templateId: string, body: UploadHbsInput) =>
    apiRequest<BranchDocumentTemplate>(`${tplUrl(branchId, templateId)}/hbs`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createField: (
    branchId: string,
    templateId: string,
    body: CreateBranchDocumentTemplateFieldInput,
  ) =>
    apiRequest<BranchDocumentTemplate>(`${tplUrl(branchId, templateId)}/fields`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateField: (
    branchId: string,
    templateId: string,
    fieldId: string,
    body: UpdateBranchDocumentTemplateFieldInput,
  ) =>
    apiRequest<BranchDocumentTemplate>(`${tplUrl(branchId, templateId)}/fields/${fieldId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteField: (branchId: string, templateId: string, fieldId: string) =>
    apiRequest<void>(`${tplUrl(branchId, templateId)}/fields/${fieldId}`, { method: 'DELETE' }),

  reorderFields: (branchId: string, templateId: string, body: ReorderTemplateFieldsInput) =>
    apiRequest<BranchDocumentTemplate>(`${tplUrl(branchId, templateId)}/fields/reorder`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

function invalidate(qc: ReturnType<typeof useQueryClient>, branchId: string) {
  void qc.invalidateQueries({ queryKey: branchDocKeys.templates(branchId) });
}

export function useCreateBranchDocumentTemplate(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBranchDocumentTemplateInput) => api.createTemplate(branchId, body),
    onSuccess: () => {
      invalidate(qc, branchId);
      notifications.show({ color: 'green', message: 'Template created' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to create template' }),
  });
}

export function useUpdateBranchDocumentTemplate(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      body,
    }: {
      templateId: string;
      body: UpdateBranchDocumentTemplateInput;
    }) => api.updateTemplate(branchId, templateId, body),
    onSuccess: () => {
      invalidate(qc, branchId);
      notifications.show({ color: 'green', message: 'Template updated' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to update template' }),
  });
}

export function useDeleteBranchDocumentTemplate(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => api.deleteTemplate(branchId, templateId),
    onSuccess: () => {
      invalidate(qc, branchId);
      notifications.show({ color: 'orange', message: 'Template deleted' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to delete template' }),
  });
}

export function useUploadBranchDocumentTemplateHbs(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, content }: { templateId: string; content: string }) =>
      api.uploadHbs(branchId, templateId, { content }),
    onSuccess: () => {
      invalidate(qc, branchId);
      notifications.show({ color: 'green', message: 'Template file uploaded' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to upload template file' }),
  });
}

export function useCreateTemplateField(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      body,
    }: {
      templateId: string;
      body: CreateBranchDocumentTemplateFieldInput;
    }) => api.createField(branchId, templateId, body),
    onSuccess: () => {
      invalidate(qc, branchId);
      notifications.show({ color: 'green', message: 'Field added' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to add field' }),
  });
}

export function useUpdateTemplateField(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      fieldId,
      body,
    }: {
      templateId: string;
      fieldId: string;
      body: UpdateBranchDocumentTemplateFieldInput;
    }) => api.updateField(branchId, templateId, fieldId, body),
    onSuccess: () => {
      invalidate(qc, branchId);
      notifications.show({ color: 'green', message: 'Field updated' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to update field' }),
  });
}

export function useDeleteTemplateField(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, fieldId }: { templateId: string; fieldId: string }) =>
      api.deleteField(branchId, templateId, fieldId),
    onSuccess: () => {
      invalidate(qc, branchId);
      notifications.show({ color: 'orange', message: 'Field deleted' });
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to delete field' }),
  });
}

export function useReorderTemplateFields(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      items,
    }: {
      templateId: string;
      items: ReorderTemplateFieldsInput;
    }) => api.reorderFields(branchId, templateId, items),
    onSuccess: () => {
      invalidate(qc, branchId);
    },
    onError: () => notifications.show({ color: 'red', message: 'Failed to reorder fields' }),
  });
}
