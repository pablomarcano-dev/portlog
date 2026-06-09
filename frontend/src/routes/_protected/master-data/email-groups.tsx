import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useRef } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Table,
  Button,
  ActionIcon,
  Group,
  Text,
  Alert,
} from '@mantine/core';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';
import { useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { EmailGroupCreateSchema } from '@portlog/schemas';
import type { EmailGroupCreateInput } from '@portlog/schemas';
import type { ZodSchema } from 'zod';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useEmailGroups,
  useSaveEmailGroup,
  useDeleteEmailGroup,
  emailGroupsApi,
} from '../../../lib/api/master-data/email-groups';

export const Route = createFileRoute('/_protected/master-data/email-groups')({
  component: EmailGroupsScreen,
});

function EmailGroupsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useEmailGroups();
  const saveEmailGroup = useSaveEmailGroup(selectedId);
  const deleteEmailGroup = useDeleteEmailGroup();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((g): ListItem => ({ id: g.id, label: g.name })),
        }
      : undefined,
  } as unknown as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<EmailGroupCreateInput> => {
    const group = await emailGroupsApi.get(id);
    return {
      name: group.name,
      description: group.description ?? undefined,
      comments: group.comments ?? undefined,
      members: group.members.map((m) => ({
        email: m.email,
        displayName: m.displayName ?? undefined,
        order: m.order,
      })),
    };
  }, []);

  const onSave = useCallback(
    async (values: EmailGroupCreateInput) => {
      await saveEmailGroup.mutateAsync(values);
    },
    [saveEmailGroup],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteEmailGroup.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteEmailGroup],
  );

  // Flash search — search by name
  const searchFn = useCallback(async (q: string) => {
    const res = await emailGroupsApi.list({ search: q, pageSize: 20 });
    return res.items.map((g) => ({ id: g.id, label: g.name }));
  }, []);

  return (
    <MasterDetailShell
      entityKey="email-groups"
      schema={EmailGroupCreateSchema as ZodSchema<EmailGroupCreateInput>}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <EmailGroupFields form={form} />}
    </MasterDetailShell>
  );
}

// ---------------------------------------------------------------------------
// Form fields — extracted so hooks (useFieldArray) run at component level
// ---------------------------------------------------------------------------

function EmailGroupFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<EmailGroupCreateInput>>;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'members',
  });

  type MemberColKey = 'email' | 'displayName' | 'actions';
  const MEMBER_WIDTHS: Record<MemberColKey, number> = {
    email: 240,
    displayName: 200,
    actions: 48,
  };
  const { colWidths: memberColWidths, startResize: startMemberResize } =
    useColumnResize<MemberColKey>(MEMBER_WIDTHS);

  const [pasteWarning, setPasteWarning] = useState<string | null>(null);
  const pasteInputRef = useRef<HTMLInputElement>(null);

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const raw = e.clipboardData.getData('text');
    const entries = raw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    const skipped: string[] = [];

    for (const entry of entries) {
      const parsed = z.string().email().safeParse(entry);
      if (parsed.success) {
        append({ email: parsed.data, displayName: undefined, order: fields.length });
      } else {
        skipped.push(entry);
      }
    }

    if (skipped.length > 0) {
      setPasteWarning(`Skipped invalid emails: ${skipped.join(', ')}`);
    } else {
      setPasteWarning(null);
    }

    // Clear the paste input after processing
    if (pasteInputRef.current) {
      pasteInputRef.current.value = '';
    }
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Shipping Notifications"
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <Textarea
        label="Description"
        placeholder="Brief description of this group's purpose"
        autosize
        minRows={2}
        error={form.formState.errors.description?.message}
        {...form.register('description')}
      />

      {/* Member table */}
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Members
        </Text>

        {/* Paste shortcut */}
        <TextInput
          ref={pasteInputRef}
          label="Paste emails (semicolons)"
          placeholder="Paste semicolon-separated emails here..."
          onPaste={handlePaste}
          readOnly={false}
        />
        {pasteWarning !== null && (
          <Alert
            color="yellow"
            title="Some emails were skipped"
            onClose={() => setPasteWarning(null)}
            withCloseButton
          >
            {pasteWarning}
          </Alert>
        )}

        {fields.length > 0 && (
          <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh
                  width={memberColWidths.email}
                  onResize={(e) => startMemberResize('email', e)}
                >
                  Email
                </ResizableTh>
                <ResizableTh
                  width={memberColWidths.displayName}
                  onResize={(e) => startMemberResize('displayName', e)}
                >
                  Display Name
                </ResizableTh>
                <Table.Th style={{ width: memberColWidths.actions }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field, index) => (
                <Table.Tr key={field.id}>
                  <Table.Td style={{ width: memberColWidths.email }}>
                    <TextInput
                      placeholder="email@example.com"
                      error={form.formState.errors.members?.[index]?.email?.message}
                      {...form.register(`members.${index}.email`)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: memberColWidths.displayName }}>
                    <TextInput
                      placeholder="Optional display name"
                      error={form.formState.errors.members?.[index]?.displayName?.message}
                      {...form.register(`members.${index}.displayName`)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: memberColWidths.actions }}>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => remove(index)}
                      title="Remove member"
                    >
                      ×
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {fields.length === 0 && (
          <Text size="sm" c="dimmed">
            No members yet. Add rows below or paste semicolon-separated emails above.
          </Text>
        )}

        <Group>
          <Button
            variant="outline"
            size="xs"
            onClick={() => append({ email: '', displayName: undefined, order: fields.length })}
          >
            + Add row
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
