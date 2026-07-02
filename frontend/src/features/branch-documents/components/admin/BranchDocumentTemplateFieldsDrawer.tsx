import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { BranchDocumentTemplateField } from '@portlog/schemas';
import {
  useBranchDocumentTemplates,
  useCreateTemplateField,
  useUpdateTemplateField,
  useDeleteTemplateField,
  useReorderTemplateFields,
} from '../../templateAdminApi';
import { TemplateFieldFormDrawer } from './TemplateFieldFormDrawer';

interface Props {
  branchId: string;
  templateId: string;
  opened: boolean;
  onClose: () => void;
}

export function BranchDocumentTemplateFieldsDrawer({
  branchId,
  templateId,
  opened,
  onClose,
}: Props) {
  const [fieldDrawer, setFieldDrawer] = useState<{
    open: boolean;
    field: BranchDocumentTemplateField | null;
  }>({ open: false, field: null });

  // Read live from query cache so field list always reflects latest server state
  const templatesQuery = useBranchDocumentTemplates(branchId);
  const template = templatesQuery.data?.find((t) => t.id === templateId) ?? null;

  const createField = useCreateTemplateField(branchId);
  const updateField = useUpdateTemplateField(branchId);
  const deleteField = useDeleteTemplateField(branchId);
  const reorderFields = useReorderTemplateFields(branchId);

  const fields = template ? [...template.fields].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  function onDragEnd(result: DropResult) {
    if (!result.destination || !template) return;
    const reordered = [...fields];
    const spliced = reordered.splice(result.source.index, 1);
    const removed = spliced[0];
    if (!removed) return;
    reordered.splice(result.destination.index, 0, removed);
    const items = reordered.map((f, i) => ({ id: f.id, sortOrder: i }));
    void reorderFields.mutateAsync({ templateId, items });
  }

  async function handleSaveField(data: Parameters<typeof createField.mutateAsync>[0]['body']) {
    if (fieldDrawer.field) {
      await updateField.mutateAsync({ templateId, fieldId: fieldDrawer.field.id, body: data });
    } else {
      await createField.mutateAsync({ templateId, body: data });
    }
    setFieldDrawer({ open: false, field: null });
  }

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title={
          <Stack gap={2}>
            <Title order={5}>Fields — {template?.name ?? '…'}</Title>
            <Text size="xs" c="dimmed">
              {fields.length} field{fields.length !== 1 ? 's' : ''}
            </Text>
          </Stack>
        }
        position="right"
        size="lg"
        padding="md"
      >
        <Stack gap="md">
          {templatesQuery.isLoading && <Loader size="sm" />}
          {templatesQuery.isError && <Alert color="red">Failed to load template data.</Alert>}

          {template && (
            <>
              <Group justify="flex-end">
                <Button size="xs" onClick={() => setFieldDrawer({ open: true, field: null })}>
                  Add Field
                </Button>
              </Group>

              {fields.length === 0 && (
                <Text size="sm" c="dimmed">
                  No fields yet. Add a field to define what the user will fill in.
                </Text>
              )}

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="fields">
                  {(provided) => (
                    <Stack gap="xs" ref={provided.innerRef} {...provided.droppableProps}>
                      {fields.map((field, index) => (
                        <Draggable key={field.id} draggableId={field.id} index={index}>
                          {(drag) => (
                            <Group
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              p="xs"
                              style={{
                                border: '1px solid var(--mantine-color-gray-3)',
                                borderRadius: 6,
                                background: 'var(--mantine-color-gray-0)',
                                ...drag.draggableProps.style,
                              }}
                              justify="space-between"
                              align="center"
                              wrap="nowrap"
                            >
                              <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  {...drag.dragHandleProps}
                                  style={{
                                    cursor: 'grab',
                                    color: 'var(--mantine-color-gray-5)',
                                    fontSize: 16,
                                  }}
                                >
                                  ⠿
                                </div>
                                <Stack gap={2} style={{ minWidth: 0 }}>
                                  <Group gap="xs">
                                    <Badge size="xs" variant="outline">
                                      {field.key}
                                    </Badge>
                                    <Badge size="xs" color="blue" variant="light">
                                      {field.type}
                                    </Badge>
                                    {field.required && (
                                      <Badge size="xs" color="red" variant="light">
                                        required
                                      </Badge>
                                    )}
                                  </Group>
                                  <Text size="xs" fw={500} truncate>
                                    {field.label}
                                  </Text>
                                  {field.sourceField && (
                                    <Text size="xs" c="dimmed" truncate>
                                      {'→'} {field.sourceField}
                                    </Text>
                                  )}
                                </Stack>
                              </Group>
                              <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => setFieldDrawer({ open: true, field })}
                                >
                                  {'✎'}
                                </ActionIcon>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="red"
                                  onClick={() =>
                                    void deleteField.mutateAsync({ templateId, fieldId: field.id })
                                  }
                                  loading={deleteField.isPending}
                                >
                                  {'✕'}
                                </ActionIcon>
                              </Group>
                            </Group>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Stack>
                  )}
                </Droppable>
              </DragDropContext>

              {reorderFields.isPending && <Loader size="xs" />}
            </>
          )}
        </Stack>
      </Drawer>

      <TemplateFieldFormDrawer
        opened={fieldDrawer.open}
        onClose={() => setFieldDrawer({ open: false, field: null })}
        field={fieldDrawer.field}
        onSave={handleSaveField}
        isSaving={createField.isPending || updateField.isPending}
      />
    </>
  );
}
