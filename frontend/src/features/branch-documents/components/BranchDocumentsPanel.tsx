import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
} from '@mantine/core';
import { useState } from 'react';
import { formatDateTime } from '../../../lib/format/datetime';
import type { BranchDocumentInstance, BranchDocumentTemplate } from '@portlog/schemas';
import type { Nomination } from '@portlog/schemas';
import {
  useBranchDocumentTemplates,
  useBranchDocuments,
  useCreateBranchDocument,
  useDeleteBranchDocument,
  useFinalizeBranchDocument,
  useGenerateBranchDocumentPdf,
  useOpenBranchDocumentPdf,
  useUpdateBranchDocument,
} from '../api';
import { BranchDocumentFormDrawer } from './BranchDocumentFormDrawer';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'gray',
  FINALIZED: 'yellow',
};

interface DrawerState {
  template: BranchDocumentTemplate;
  instance: BranchDocumentInstance | null;
}

interface Props {
  nomination: Nomination;
}

export function BranchDocumentsPanel({ nomination }: Props) {
  const nominationId = nomination.id;
  const branchId = nomination.branchId;

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const templatesQuery = useBranchDocumentTemplates(branchId);
  const instancesQuery = useBranchDocuments(nominationId);
  const createDoc = useCreateBranchDocument(nominationId);
  const updateDoc = useUpdateBranchDocument(nominationId);
  const finalizeDoc = useFinalizeBranchDocument(nominationId);
  const generatePdf = useGenerateBranchDocumentPdf(nominationId);
  const openPdf = useOpenBranchDocumentPdf(nominationId);
  const deleteDoc = useDeleteBranchDocument(nominationId);

  if (!branchId) {
    return (
      <Alert color="gray" title="No branch assigned">
        Assign a branch to this nomination to access branch documents.
      </Alert>
    );
  }

  if (templatesQuery.isLoading || instancesQuery.isLoading) {
    return <Loader size="sm" />;
  }

  if (templatesQuery.isError) {
    return <Alert color="red">Failed to load document templates.</Alert>;
  }

  const templates = templatesQuery.data ?? [];
  const instances = instancesQuery.data ?? [];

  function instancesForTemplate(templateId: string) {
    return instances.filter((i) => i.templateId === templateId);
  }

  function openNew(template: BranchDocumentTemplate) {
    setDrawer({ template, instance: null });
  }

  function openEdit(template: BranchDocumentTemplate, instance: BranchDocumentInstance) {
    setDrawer({ template, instance });
  }

  async function handleSave(data: Record<string, unknown>, title?: string) {
    if (!drawer) return;
    if (drawer.instance) {
      await updateDoc.mutateAsync({ instanceId: drawer.instance.id, body: { data, title } });
    } else {
      await createDoc.mutateAsync({ templateId: drawer.template.id, data, title });
    }
    setDrawer(null);
  }

  async function handleGeneratePdf(instanceId: string) {
    setGeneratingId(instanceId);
    try {
      await generatePdf.mutateAsync(instanceId);
      await openPdf.mutateAsync(instanceId);
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleDownload(instance: BranchDocumentInstance) {
    if (!instance.minioKey) return;
    await openPdf.mutateAsync(instance.id);
  }

  return (
    <>
      <Stack gap="md">
        {templates.length === 0 && (
          <Alert color="blue">No document templates configured for this branch.</Alert>
        )}

        {templates.map((template) => {
          const templateInstances = instancesForTemplate(template.id);
          return (
            <Stack key={template.id} gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={600} size="sm">
                  {template.name}
                </Text>
                <Button size="xs" variant="light" onClick={() => openNew(template)}>
                  New
                </Button>
              </Group>

              {templateInstances.length === 0 && (
                <Text size="xs" c="dimmed">
                  No documents yet.
                </Text>
              )}

              {templateInstances.map((instance) => (
                <InstanceRow
                  key={instance.id}
                  instance={instance}
                  template={template}
                  onEdit={() => openEdit(template, instance)}
                  onFinalize={() => void finalizeDoc.mutateAsync(instance.id)}
                  onGenerate={() => void handleGeneratePdf(instance.id)}
                  onDownload={() => void handleDownload(instance)}
                  onDelete={() => void deleteDoc.mutateAsync(instance.id)}
                  isGenerating={generatingId === instance.id}
                  isFinalizing={finalizeDoc.isPending}
                />
              ))}

              <Divider mt="xs" />
            </Stack>
          );
        })}
      </Stack>

      {drawer && (
        <BranchDocumentFormDrawer
          opened={Boolean(drawer)}
          onClose={() => setDrawer(null)}
          template={drawer.template}
          instance={drawer.instance}
          nomination={nomination}
          onSave={handleSave}
          isSaving={createDoc.isPending || updateDoc.isPending}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// InstanceRow
// ---------------------------------------------------------------------------

interface InstanceRowProps {
  instance: BranchDocumentInstance;
  template: BranchDocumentTemplate;
  onEdit: () => void;
  onFinalize: () => void;
  onGenerate: () => void;
  onDownload: () => void;
  onDelete: () => void;
  isGenerating: boolean;
  isFinalizing: boolean;
}

function InstanceRow({
  instance,
  onEdit,
  onFinalize,
  onGenerate,
  onDownload,
  onDelete,
  isGenerating,
  isFinalizing,
}: InstanceRowProps) {
  const isFinalized = instance.status === 'FINALIZED';
  const hasPdf = Boolean(instance.minioKey);

  return (
    <Group
      p="xs"
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 6,
        background: 'var(--mantine-color-gray-0)',
      }}
      justify="space-between"
      align="center"
      wrap="nowrap"
    >
      <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
        <Group gap="xs" align="center">
          <Badge size="xs" color={STATUS_COLORS[instance.status] ?? 'gray'} variant="light">
            {instance.status}
          </Badge>
          <Text size="xs" fw={500} truncate>
            {instance.title ?? new Date(instance.createdAt).toLocaleDateString('es-VE')}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          by {instance.createdBy.email} · {formatDateTime(instance.updatedAt, 'es-VE')}
        </Text>
      </Stack>

      <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
        {hasPdf && (
          <ActionIcon
            size="sm"
            variant="light"
            color="blue"
            title="Download PDF"
            onClick={onDownload}
            loading={isGenerating}
          >
            ↓
          </ActionIcon>
        )}

        <Menu shadow="md" width={180}>
          <Menu.Target>
            <ActionIcon size="sm" variant="subtle">
              ⋯
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {!isFinalized && <Menu.Item onClick={onEdit}>Edit</Menu.Item>}
            {isFinalized && <Menu.Item onClick={onEdit}>View</Menu.Item>}
            {!isFinalized && (
              <Menu.Item onClick={onFinalize} disabled={isFinalizing} color="yellow">
                Finalize
              </Menu.Item>
            )}
            <Menu.Item onClick={onGenerate} disabled={isGenerating}>
              {hasPdf ? 'Regenerate PDF' : 'Generate PDF'}
            </Menu.Item>
            {hasPdf && (
              <Menu.Item onClick={onDownload} color="blue">
                Download PDF
              </Menu.Item>
            )}
            <Menu.Divider />
            {!isFinalized && (
              <Menu.Item color="red" onClick={onDelete}>
                Delete
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
