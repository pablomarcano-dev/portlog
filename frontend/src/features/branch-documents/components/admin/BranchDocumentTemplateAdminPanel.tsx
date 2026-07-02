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
import type { BranchDocumentTemplate } from '@portlog/schemas';
import {
  useBranchDocumentTemplates,
  useDeleteBranchDocumentTemplate,
} from '../../templateAdminApi';
import { BranchDocumentTemplateFormDrawer } from './BranchDocumentTemplateFormDrawer';
import { BranchDocumentTemplateFieldsDrawer } from './BranchDocumentTemplateFieldsDrawer';

interface Props {
  branchId: string;
}

export function BranchDocumentTemplateAdminPanel({ branchId }: Props) {
  const templatesQuery = useBranchDocumentTemplates(branchId);
  const deleteTemplate = useDeleteBranchDocumentTemplate(branchId);

  const [formDrawer, setFormDrawer] = useState<{
    open: boolean;
    template: BranchDocumentTemplate | null;
  }>({ open: false, template: null });

  const [fieldsDrawer, setFieldsDrawer] = useState<{
    open: boolean;
    templateId: string | null;
  }>({ open: false, templateId: null });

  if (templatesQuery.isLoading) return <Loader size="sm" />;
  if (templatesQuery.isError) return <Alert color="red">Failed to load document templates.</Alert>;

  const templates = [...(templatesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {templates.length} template{templates.length !== 1 ? 's' : ''} configured
          </Text>
          <Button size="xs" onClick={() => setFormDrawer({ open: true, template: null })}>
            Add Template
          </Button>
        </Group>

        {templates.length === 0 && (
          <Alert color="blue" variant="light">
            No document templates yet. Add one to enable document generation for nominations in this
            branch.
          </Alert>
        )}

        {templates.map((template) => (
          <Stack key={template.id} gap={0}>
            <Group
              p="sm"
              style={{
                border: '1px solid var(--mantine-color-gray-3)',
                borderRadius: 6,
                background: 'var(--mantine-color-gray-0)',
              }}
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
            >
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs" align="center">
                  <Text fw={600} size="sm">
                    {template.name}
                  </Text>
                  <Badge size="xs" variant="outline">
                    {template.code}
                  </Badge>
                  <Badge
                    size="xs"
                    color={template.hbsTemplate ? 'green' : 'orange'}
                    variant="light"
                  >
                    {template.hbsTemplate ? 'HBS uploaded' : 'No file'}
                  </Badge>
                </Group>
                {template.description && (
                  <Text size="xs" c="dimmed">
                    {template.description}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {template.fields.length} field{template.fields.length !== 1 ? 's' : ''} · sort:{' '}
                  {template.sortOrder}
                </Text>
              </Stack>

              <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setFieldsDrawer({ open: true, templateId: template.id })}
                >
                  Fields ({template.fields.length})
                </Button>

                <Menu shadow="md" width={160}>
                  <Menu.Target>
                    <ActionIcon size="sm" variant="subtle">
                      {'⋯'}
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => setFormDrawer({ open: true, template })}>
                      Edit
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete template "${template.name}"? This cannot be undone.`,
                          )
                        ) {
                          void deleteTemplate.mutateAsync(template.id);
                        }
                      }}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
            <Divider mt="xs" />
          </Stack>
        ))}
      </Stack>

      <BranchDocumentTemplateFormDrawer
        branchId={branchId}
        template={formDrawer.template}
        opened={formDrawer.open}
        onClose={() => setFormDrawer({ open: false, template: null })}
      />

      {fieldsDrawer.templateId && (
        <BranchDocumentTemplateFieldsDrawer
          branchId={branchId}
          templateId={fieldsDrawer.templateId}
          opened={fieldsDrawer.open}
          onClose={() => setFieldsDrawer({ open: false, templateId: null })}
        />
      )}
    </>
  );
}
