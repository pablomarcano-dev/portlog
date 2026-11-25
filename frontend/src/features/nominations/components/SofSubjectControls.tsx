import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import {
  sofActivitySubject,
  sofSubjectActivityInputSchema,
  sofSubjectActivitySchema,
  sofSubjectOptionsSchema,
  type SofSubjectActivity,
  type SofSubjectActivityInput,
} from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import { useCurrentUser } from '../../../lib/auth/queries';
import { zodResolver } from '../../../lib/zodResolver';

const optionsKey = ['sof-subject-options'] as const;
interface Props {
  nominationId: string;
  opened: boolean;
  mode: 'statement' | 'activity';
  selectedId: string;
  subject: string;
  interim: boolean;
  error?: string;
  onNestedModalChange: (opened: boolean) => void;
  onChange: (mode: 'statement' | 'activity', id: string, subject: string) => void;
}

export function SofSubjectControls({
  nominationId,
  opened,
  mode,
  selectedId,
  subject,
  interim,
  error,
  onChange,
  onNestedModalChange,
}: Props) {
  const { data: user } = useCurrentUser();
  const [manageOpen, setManageOpen] = useState(false);
  const query = useQuery({
    queryKey: [...optionsKey, nominationId],
    queryFn: async () =>
      sofSubjectOptionsSchema.parse(
        await apiRequest<unknown>(`/nominations/${nominationId}/sof-subject-activities`),
      ),
    enabled: opened,
    staleTime: 0,
  });
  const suggestedForDraft = useRef(false);
  useEffect(() => {
    if (!opened) suggestedForDraft.current = false;
  }, [opened]);
  useEffect(() => {
    if (opened && mode === 'activity' && !selectedId && !suggestedForDraft.current && query.data) {
      suggestedForDraft.current = true;
      const suggestion = query.data.items.find((item) => item.id === query.data.suggestedId);
      if (suggestion)
        onChange('activity', suggestion.id, sofActivitySubject(subject, suggestion.label));
    }
  }, [opened, mode, selectedId, query.data, subject, onChange]);

  function selectMode(next: string | null) {
    if (next === 'activity') {
      suggestedForDraft.current = false;
      onChange('activity', '', subject);
    } else {
      const base = subject
        .replace(/\s*::.*$/s, '')
        .replace(/\s*-\s*(?:Interim|Final) Statement of Facts\s*$/i, '')
        .trim();
      onChange('statement', '', `${base} - ${interim ? 'Interim' : 'Final'} Statement of Facts`);
    }
  }
  return (
    <Stack
      gap="xs"
      p="sm"
      style={{
        borderLeft: '3px solid var(--mantine-color-blue-6)',
        background: 'var(--mantine-color-gray-0)',
      }}
    >
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          SOF subject
        </Text>
        {(user?.role === 'ADM' || user?.role === 'FLT') && (
          <Button
            type="button"
            variant="subtle"
            size="compact-xs"
            onClick={() => {
              setManageOpen(true);
              onNestedModalChange(true);
            }}
          >
            Manage activity labels
          </Button>
        )}
      </Group>
      <Select
        label="Subject type"
        value={mode}
        onChange={selectMode}
        allowDeselect={false}
        data={[
          {
            value: 'statement',
            label: interim ? 'Interim Statement of Facts' : 'Final Statement of Facts',
          },
          { value: 'activity', label: 'Specific activity update' },
        ]}
      />
      {mode === 'activity' && (
        <>
          {query.isError && (
            <Alert color="red">
              Activity labels could not be loaded. Retry before selecting an activity.{' '}
              <Button type="button" size="compact-xs" onClick={() => void query.refetch()}>
                Retry
              </Button>
            </Alert>
          )}
          <Select
            label="SOF activity"
            required
            searchable
            clearable
            value={selectedId || null}
            disabled={query.isLoading || query.isError}
            placeholder={query.isLoading ? 'Loading activity labels…' : 'Choose an activity'}
            description="Suggested from the latest saved SOF event when it has one matching label. You can choose another activity."
            data={(query.data?.items ?? []).map((item) => ({ value: item.id, label: item.label }))}
            error={error}
            onChange={(id) => {
              suggestedForDraft.current = true;
              const item = query.data?.items.find((option) => option.id === id);
              onChange(
                'activity',
                id ?? '',
                item ? sofActivitySubject(subject, item.label) : subject,
              );
            }}
          />
        </>
      )}
      <SofSubjectActivityManager
        opened={manageOpen}
        onClose={() => {
          setManageOpen(false);
          onNestedModalChange(false);
        }}
      />
    </Stack>
  );
}

function SofSubjectActivityManager({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'sof-subject-activities'],
    queryFn: async () =>
      sofSubjectActivitySchema
        .array()
        .parse(await apiRequest<unknown>('/admin/sof-subject-activities')),
    enabled: opened,
  });
  const form = useForm<SofSubjectActivityInput>({
    resolver: zodResolver(sofSubjectActivityInputSchema),
    defaultValues: { label: '', eventNames: [], active: true },
  });
  function select(id: string | null) {
    setSelectedId(id);
    const item = query.data?.find((row) => row.id === id);
    form.reset(
      item
        ? { label: item.label, eventNames: item.eventNames, active: item.active }
        : { label: '', eventNames: [], active: true },
    );
  }
  const save = useMutation({
    mutationFn: async (input: SofSubjectActivityInput) =>
      sofSubjectActivitySchema.parse(
        await apiRequest<unknown>(
          selectedId
            ? `/admin/sof-subject-activities/${selectedId}`
            : '/admin/sof-subject-activities',
          { method: selectedId ? 'PATCH' : 'POST', body: JSON.stringify(input) },
        ),
      ),
    onSuccess: async (item: SofSubjectActivity) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'sof-subject-activities'] }),
        qc.invalidateQueries({ queryKey: optionsKey }),
      ]);
      setSelectedId(item.id);
      form.reset({ label: item.label, eventNames: item.eventNames, active: item.active });
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title="SOF subject activity labels" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          These labels affect email subjects only. Deactivating or renaming a label never changes
          saved SOF events or previously sent messages.
        </Text>
        {query.isError && (
          <Alert color="red">
            Could not load the catalog.{' '}
            <Button type="button" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </Alert>
        )}
        <Select
          label="Edit a label"
          clearable
          searchable
          placeholder="New activity label"
          value={selectedId}
          onChange={select}
          data={(query.data ?? []).map((r) => ({
            value: r.id,
            label: r.label + (r.active ? '' : ' (inactive)'),
          }))}
        />
        <form
          onSubmit={(e) => {
            e.stopPropagation();
            void form.handleSubmit((input) => save.mutate(input))(e);
          }}
        >
          <Stack gap="sm">
            <TextInput
              label="Subject label"
              required
              {...form.register('label')}
              error={form.formState.errors.label?.message}
            />
            <Controller
              name="eventNames"
              control={form.control}
              render={({ field }) => (
                <Textarea
                  label="Matching saved SOF activity names"
                  description="One exact activity name per line. Use explicit aliases for differently worded SOF events."
                  value={field.value.join('\n')}
                  onChange={(e) => field.onChange(e.currentTarget.value.split('\n'))}
                  onBlur={() => field.onChange(field.value.map((v) => v.trim()).filter(Boolean))}
                  error={form.formState.errors.eventNames?.message}
                  minRows={3}
                />
              )}
            />
            <Controller
              name="active"
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  label="Available for new subjects"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {save.isError && (
              <Alert color="red">
                {save.error instanceof Error ? save.error.message : 'Could not save label.'}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button type="button" variant="default" onClick={() => select(null)}>
                New label
              </Button>
              <Button type="submit" loading={save.isPending}>
                Save label
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Modal>
  );
}
