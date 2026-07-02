import {
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  TagsInput,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import type {
  BranchDocumentTemplateField,
  CreateBranchDocumentTemplateFieldInput,
} from '@portlog/schemas';

const FIELD_TYPES = ['TEXT', 'DATE', 'DATETIME', 'NUMBER', 'TEXTAREA', 'SELECT'] as const;

const SOURCE_FIELD_OPTIONS = [
  { value: 'nomination.vesselName', label: 'Vessel Name' },
  { value: 'nomination.imo', label: 'IMO Number' },
  { value: 'nomination.flag', label: 'Flag / Nationality' },
  { value: 'nomination.grt', label: 'GRT (Gross Tonnage)' },
  { value: 'nomination.nrt', label: 'NRT (Net Tonnage)' },
  { value: 'nomination.loa', label: 'LOA (Length Overall)' },
  { value: 'nomination.master', label: 'Captain / Master' },
  { value: 'nomination.opPortName', label: 'Op Port Name' },
  { value: 'nomination.lastPortName', label: 'Last Port Name' },
  { value: 'nomination.nextPortName', label: 'Next Port Name' },
  { value: 'nomination.etaDate', label: 'ETA Date' },
  { value: 'branch.contactName', label: 'Branch Contact Name' },
  { value: 'branch.contactTitle', label: 'Branch Contact Title' },
];

interface Props {
  opened: boolean;
  onClose: () => void;
  field?: BranchDocumentTemplateField | null;
  onSave: (data: CreateBranchDocumentTemplateFieldInput) => Promise<void>;
  isSaving: boolean;
}

type FieldForm = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  sourceField: string | null;
  placeholder: string;
  options: string[];
  sortOrder: number;
};

const EMPTY: FieldForm = {
  key: '',
  label: '',
  type: 'TEXT',
  required: false,
  sourceField: null,
  placeholder: '',
  options: [],
  sortOrder: 0,
};

export function TemplateFieldFormDrawer({ opened, onClose, field, onSave, isSaving }: Props) {
  const [form, setForm] = useState<FieldForm>(EMPTY);
  const isEdit = Boolean(field);

  useEffect(() => {
    if (opened) {
      setForm(
        field
          ? {
              key: field.key,
              label: field.label,
              type: field.type,
              required: field.required,
              sourceField: field.sourceField ?? null,
              placeholder: field.placeholder ?? '',
              options: field.options ?? [],
              sortOrder: field.sortOrder,
            }
          : EMPTY,
      );
    }
  }, [opened, field]);

  function set<K extends keyof FieldForm>(k: K, v: FieldForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    await onSave({
      key: form.key,
      label: form.label,
      type: form.type as CreateBranchDocumentTemplateFieldInput['type'],
      required: form.required,
      sourceField: form.sourceField || null,
      placeholder: form.placeholder || null,
      options: form.options,
      sortOrder: form.sortOrder,
    });
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Title order={5}>{isEdit ? 'Edit Field' : 'Add Field'}</Title>}
      position="right"
      size="sm"
      padding="md"
    >
      <Stack gap="sm">
        <TextInput
          label="Key"
          description="snake_case identifier used in the template as {{doc.key}}"
          placeholder="e.g. vessel_name"
          required
          value={form.key}
          onChange={(e) => set('key', e.currentTarget.value)}
          disabled={isEdit}
        />
        <TextInput
          label="Label"
          placeholder="e.g. Vessel Name"
          required
          value={form.label}
          onChange={(e) => set('label', e.currentTarget.value)}
        />
        <Select
          label="Type"
          data={FIELD_TYPES.map((t) => ({ value: t, label: t }))}
          value={form.type}
          onChange={(v) => set('type', v ?? 'TEXT')}
        />
        <Select
          label="Auto-fill Source"
          description="Pre-populate from nomination or branch data"
          data={SOURCE_FIELD_OPTIONS}
          value={form.sourceField}
          onChange={(v) => set('sourceField', v)}
          clearable
          placeholder="None (manual entry)"
        />
        <TextInput
          label="Placeholder"
          placeholder="Hint shown in the form field"
          value={form.placeholder}
          onChange={(e) => set('placeholder', e.currentTarget.value)}
        />
        {form.type === 'SELECT' && (
          <TagsInput
            label="Options"
            description="Press Enter after each option"
            value={form.options}
            onChange={(v) => set('options', v)}
            placeholder="Add option..."
          />
        )}
        <NumberInput
          label="Sort Order"
          min={0}
          value={form.sortOrder}
          onChange={(v) => set('sortOrder', typeof v === 'number' ? v : 0)}
        />
        <Switch
          label="Required"
          checked={form.required}
          onChange={(e) => set('required', e.currentTarget.checked)}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={isSaving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
