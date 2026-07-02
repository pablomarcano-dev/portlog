import {
  Alert,
  Button,
  Drawer,
  Group,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import type { BranchDocumentTemplate, CreateBranchDocumentTemplateInput } from '@portlog/schemas';
import {
  useCreateBranchDocumentTemplate,
  useUpdateBranchDocumentTemplate,
  useUploadBranchDocumentTemplateHbs,
} from '../../templateAdminApi';

interface Props {
  branchId: string;
  template?: BranchDocumentTemplate | null;
  opened: boolean;
  onClose: () => void;
}

type FormState = {
  name: string;
  code: string;
  description: string;
  sortOrder: number;
};

const EMPTY: FormState = { name: '', code: '', description: '', sortOrder: 0 };

export function BranchDocumentTemplateFormDrawer({ branchId, template, opened, onClose }: Props) {
  const isEdit = Boolean(template);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [hbsContent, setHbsContent] = useState<string | null>(null);
  const [hbsFilename, setHbsFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTemplate = useCreateBranchDocumentTemplate(branchId);
  const updateTemplate = useUpdateBranchDocumentTemplate(branchId);
  const uploadHbs = useUploadBranchDocumentTemplateHbs(branchId);

  const isSaving = createTemplate.isPending || updateTemplate.isPending || uploadHbs.isPending;

  useEffect(() => {
    if (opened) {
      setForm(
        template
          ? {
              name: template.name,
              code: template.code,
              description: template.description ?? '',
              sortOrder: template.sortOrder,
            }
          : EMPTY,
      );
      setHbsContent(null);
      setHbsFilename(null);
      setError(null);
    }
  }, [opened, template]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHbsFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setHbsContent(ev.target?.result as string);
    reader.readAsText(file, 'utf-8');
  }

  async function handleSave() {
    setError(null);
    try {
      const body: CreateBranchDocumentTemplateInput = {
        name: form.name,
        code: form.code.toUpperCase(),
        description: form.description || null,
        sortOrder: form.sortOrder,
      };

      let savedTemplate: BranchDocumentTemplate;
      if (isEdit && template) {
        savedTemplate = await updateTemplate.mutateAsync({ templateId: template.id, body });
      } else {
        savedTemplate = await createTemplate.mutateAsync(body);
      }

      if (hbsContent) {
        await uploadHbs.mutateAsync({ templateId: savedTemplate.id, content: hbsContent });
      }

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    }
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Title order={5}>{isEdit ? `Edit — ${template?.name}` : 'New Document Template'}</Title>
      }
      position="right"
      size="md"
      padding="md"
    >
      <Stack gap="sm">
        {error && <Alert color="red">{error}</Alert>}

        <TextInput
          label="Name"
          placeholder="e.g. Aviso de Arribo"
          required
          value={form.name}
          onChange={(e) => set('name', e.currentTarget.value)}
        />
        <TextInput
          label="Code"
          placeholder="e.g. AVISO_ARRIBO"
          description={
            isEdit
              ? 'Code cannot be changed after creation'
              : 'Uppercase, letters and underscores only'
          }
          required
          disabled={isEdit}
          value={form.code}
          onChange={(e) => set('code', e.currentTarget.value.toUpperCase())}
        />
        <Textarea
          label="Description"
          placeholder="Brief description of this document"
          value={form.description}
          onChange={(e) => set('description', e.currentTarget.value)}
          autosize
          minRows={2}
        />
        <NumberInput
          label="Sort Order"
          min={0}
          value={form.sortOrder}
          onChange={(v) => set('sortOrder', typeof v === 'number' ? v : 0)}
        />

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Handlebars Template (.hbs)
          </Text>
          {isEdit && template?.hbsTemplate && !hbsFilename && (
            <Text size="xs" c="dimmed">
              Current: {template.hbsTemplate}
            </Text>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".hbs,.html"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={() => fileInputRef.current?.click()}>
              {isEdit ? 'Replace file...' : 'Choose file...'}
            </Button>
            {hbsFilename && (
              <Text size="xs" c="green">
                {hbsFilename}
              </Text>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            The template uses Handlebars syntax. Variables: nomination.vesselName, doc.field_key,
            branch.contactName, etc.
          </Text>
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            loading={isSaving}
            disabled={!form.name || !form.code}
          >
            {isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
