import {
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import type {
  BranchDocumentInstance,
  BranchDocumentTemplate,
  BranchDocumentTemplateField,
} from '@portlog/schemas';
import type { Nomination } from '@portlog/schemas';

interface Props {
  opened: boolean;
  onClose: () => void;
  template: BranchDocumentTemplate;
  instance?: BranchDocumentInstance | null;
  nomination: Nomination;
  onSave: (data: Record<string, unknown>, title?: string) => Promise<void>;
  isSaving: boolean;
}

// Resolve a sourceField path against the nomination to auto-populate a field
function resolveSource(sourceField: string, nomination: Nomination): string {
  const map: Record<string, () => string | null | undefined> = {
    'nomination.vesselName': () => nomination.shipParticular.name,
    'nomination.imo': () => nomination.shipParticular.imoNumber,
    'nomination.master': () => nomination.master,
    'nomination.opPortName': () => nomination.opPort?.name,
    'nomination.lastPortName': () => nomination.lastPort?.name,
    'nomination.nextPortName': () => nomination.nextPort?.name,
    'nomination.etaDate': () =>
      nomination.etaDate
        ? new Date(nomination.etaDate).toLocaleDateString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : null,
  };
  return map[sourceField]?.() ?? '';
}

function getInitialValues(
  fields: BranchDocumentTemplateField[],
  existing: Record<string, unknown> | null | undefined,
  nomination: Nomination,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (existing && existing[field.key] !== undefined && existing[field.key] !== '') {
      values[field.key] = existing[field.key];
    } else if (field.sourceField) {
      values[field.key] = resolveSource(field.sourceField, nomination);
    } else {
      values[field.key] = field.type === 'NUMBER' ? '' : '';
    }
  }
  return values;
}

export function BranchDocumentFormDrawer({
  opened,
  onClose,
  template,
  instance,
  nomination,
  onSave,
  isSaving,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (opened) {
      setValues(
        getInitialValues(
          template.fields,
          instance?.data as Record<string, unknown> | null,
          nomination,
        ),
      );
      setTitle(instance?.title ?? '');
    }
  }, [opened, template.fields, instance, nomination]);

  const isFinalized = instance?.status === 'FINALIZED';

  function set(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    await onSave(values, title || undefined);
  }

  function renderField(field: BranchDocumentTemplateField) {
    const value = values[field.key];
    const disabled = isFinalized;

    switch (field.type) {
      case 'TEXTAREA':
        return (
          <Textarea
            key={field.key}
            label={field.label}
            required={field.required}
            placeholder={field.placeholder ?? undefined}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => set(field.key, e.currentTarget.value)}
            disabled={disabled}
            autosize
            minRows={3}
          />
        );

      case 'NUMBER':
        return (
          <NumberInput
            key={field.key}
            label={field.label}
            required={field.required}
            placeholder={field.placeholder ?? undefined}
            value={
              typeof value === 'number'
                ? value
                : typeof value === 'string' && value !== ''
                  ? Number(value)
                  : ''
            }
            onChange={(v) => set(field.key, v)}
            disabled={disabled}
          />
        );

      case 'DATE':
        return (
          <TextInput
            key={field.key}
            label={field.label}
            required={field.required}
            placeholder={field.placeholder ?? 'DD/MM/YYYY'}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => set(field.key, e.currentTarget.value)}
            disabled={disabled}
          />
        );

      case 'SELECT':
        return (
          <Select
            key={field.key}
            label={field.label}
            required={field.required}
            placeholder={field.placeholder ?? `Select ${field.label}`}
            data={field.options}
            value={typeof value === 'string' ? value : null}
            onChange={(v) => set(field.key, v ?? '')}
            disabled={disabled}
            clearable
          />
        );

      default:
        return (
          <TextInput
            key={field.key}
            label={field.label}
            required={field.required}
            placeholder={field.placeholder ?? undefined}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => set(field.key, e.currentTarget.value)}
            disabled={disabled}
          />
        );
    }
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Stack gap={2}>
          <Title order={5}>{template.name}</Title>
          {template.description && (
            <Text size="xs" c="dimmed">
              {template.description}
            </Text>
          )}
        </Stack>
      }
      position="right"
      size="md"
      padding="md"
    >
      <Stack gap="sm">
        <TextInput
          label="Title (optional)"
          placeholder="e.g. Antidrogas – B/T Bianca 2026-06-18"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          disabled={isFinalized}
        />

        {template.fields.map((f) => renderField(f))}

        {isFinalized && (
          <Text size="xs" c="orange">
            This document is finalized and cannot be edited.
          </Text>
        )}

        {!isFinalized && (
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Save
            </Button>
          </Group>
        )}
      </Stack>
    </Drawer>
  );
}
