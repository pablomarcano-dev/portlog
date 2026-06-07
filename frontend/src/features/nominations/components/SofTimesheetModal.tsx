import { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  TextInput,
  Grid,
  Table,
  Select,
  ActionIcon,
  Box,
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { useNominationSof, useNominationSofSave } from '../hooks/useNominationSof';
import { useActivities } from '../../../lib/api/master-data/activities';
import type { SofTimesheetResponse } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Form schema — mirrors SofTimesheetInput but uses native Date + string time
// for the split Date/Time inputs; combined to ISO on save.
// ---------------------------------------------------------------------------

const sofEntryFormSchema = z.object({
  date: z.date().nullable(),
  time: z.string().default(''),
  activityId: z.string().nullable(),
  comment: z.string().default(''),
});

const sofFormSchema = z.object({
  lastPortId: z.string().nullable(),
  nextPortId: z.string().nullable(),
  pierId: z.string().nullable(),
  captain: z.string().default(''),
  mobileOnBoard: z.string().default(''),
  entries: z.array(sofEntryFormSchema).default([]),
});

type SofFormValues = z.infer<typeof sofFormSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Combine a Date (date portion only) and a "HH:MM" string into a UTC ISO string.
 * If date is null, returns null.
 */
function combineDateTime(date: Date | null, time: string): string | null {
  if (!date) return null;
  const [hh = '00', mm = '00'] = time.split(':');
  const d = new Date(date);
  d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
  return d.toISOString();
}

/**
 * Split a Date into { date: Date, time: "HH:MM" }.
 */
function splitDateTime(dt: Date): { date: Date; time: string } {
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return { date: dt, time: `${hh}:${mm}` };
}

function buildDefaultValues(data: SofTimesheetResponse | undefined): SofFormValues {
  if (!data) {
    return {
      lastPortId: null,
      nextPortId: null,
      pierId: null,
      captain: '',
      mobileOnBoard: '',
      entries: [],
    };
  }
  return {
    lastPortId: data.lastPortId ?? null,
    nextPortId: data.nextPortId ?? null,
    pierId: data.pierId ?? null,
    captain: data.captain ?? '',
    mobileOnBoard: data.mobileOnBoard ?? '',
    entries: data.entries.map((e) => {
      const { date, time } = splitDateTime(e.occurredAt);
      return {
        date,
        time,
        activityId: e.activityId ?? null,
        comment: e.comment ?? '',
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SofTimesheetModalProps {
  nominationId: string;
  opened: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SofTimesheetModal({ nominationId, opened, onClose }: SofTimesheetModalProps) {
  const { data: sofData, isLoading } = useNominationSof(nominationId);
  const saveMutation = useNominationSofSave(nominationId);

  // Port search state for general info pickers
  const [lastPortSearch, setLastPortSearch] = useState('');
  const [nextPortSearch, setNextPortSearch] = useState('');
  const [pierSearch, setPierSearch] = useState('');

  // Activities for dropdown
  const { data: activitiesData } = useActivities({ limit: 200 });
  const activityOptions = (activitiesData?.items ?? []).map((a) => ({
    value: a.id,
    label: a.name,
  }));

  const form = useForm<SofFormValues>({
    resolver: zodResolver(sofFormSchema),
    defaultValues: buildDefaultValues(sofData),
    values: sofData ? buildDefaultValues(sofData) : undefined,
  });

  const { control, register, handleSubmit, formState } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'entries' });

  // Dirty check for close confirmation
  const [confirmClose, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  function handleClose() {
    if (formState.isDirty) {
      openConfirm();
    } else {
      onClose();
    }
  }

  function handleConfirmedClose() {
    closeConfirm();
    onClose();
  }

  function handleInsert() {
    append({ date: null, time: '', activityId: null, comment: '' });
  }

  function handleDelete() {
    if (fields.length > 0) {
      remove(fields.length - 1);
    }
  }

  function onSubmit(vals: SofFormValues) {
    const entries = vals.entries
      .map((e, i) => {
        const iso = combineDateTime(e.date, e.time);
        if (!iso) return null;
        return {
          occurredAt: iso,
          activityId: e.activityId ?? null,
          comment: e.comment || null,
          order: i,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    saveMutation.mutate(
      {
        lastPortId: vals.lastPortId ?? null,
        nextPortId: vals.nextPortId ?? null,
        pierId: vals.pierId ?? null,
        captain: vals.captain || null,
        mobileOnBoard: vals.mobileOnBoard || null,
        entries,
      },
      {
        onSuccess: () => {
          form.reset(vals); // clear dirty state after successful save
        },
      },
    );
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        title="Statement of Facts"
        size="xl"
        closeOnClickOutside={false}
      >
        {isLoading ? (
          <Text c="dimmed" size="sm">
            Loading...
          </Text>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="md">
              {/* General Info section */}
              <Text fw={600} size="sm">
                General Info
              </Text>

              <Grid gutter="xs">
                <Grid.Col span={4}>
                  <Controller
                    name="lastPortId"
                    control={control}
                    render={({ field }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Last Port"
                        value={field.value}
                        onChange={field.onChange}
                        searchValue={lastPortSearch}
                        onSearchChange={setLastPortSearch}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Controller
                    name="nextPortId"
                    control={control}
                    render={({ field }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Next Port"
                        value={field.value}
                        onChange={field.onChange}
                        searchValue={nextPortSearch}
                        onSearchChange={setNextPortSearch}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Controller
                    name="pierId"
                    control={control}
                    render={({ field }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Berth"
                        value={field.value}
                        onChange={field.onChange}
                        searchValue={pierSearch}
                        onSearchChange={setPierSearch}
                        placeholder="Search piers..."
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput label="Captain" {...register('captain')} />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput label="Mobile on Board" {...register('mobileOnBoard')} />
                </Grid.Col>
              </Grid>

              {/* Times Sheet section */}
              <Box>
                <Group justify="space-between" mb="xs">
                  <Text fw={600} size="sm">
                    Times Sheet
                  </Text>
                  <Group gap="xs">
                    <Button size="xs" variant="light" onClick={handleInsert}>
                      Insert
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      onClick={handleDelete}
                      disabled={fields.length === 0}
                    >
                      Delete
                    </Button>
                  </Group>
                </Group>

                <Table withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 130 }}>Date</Table.Th>
                      <Table.Th style={{ width: 90 }}>Time</Table.Th>
                      <Table.Th style={{ minWidth: 160 }}>Activity</Table.Th>
                      <Table.Th>Comment</Table.Th>
                      <Table.Th style={{ width: 40 }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {fields.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed" size="xs" ta="center" py="xs">
                            No entries. Click Insert to add a row.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {fields.map((field, index) => (
                      <Table.Tr key={field.id}>
                        <Table.Td>
                          <Controller
                            name={`entries.${index}.date`}
                            control={control}
                            render={({ field: f }) => (
                              <DatePickerInput
                                value={f.value}
                                onChange={f.onChange}
                                placeholder="Date"
                                size="xs"
                                clearable
                                valueFormat="DD/MM/YYYY"
                                styles={{ input: { fontSize: 12 } }}
                              />
                            )}
                          />
                        </Table.Td>
                        <Table.Td>
                          <TimeInput
                            {...register(`entries.${index}.time`)}
                            size="xs"
                            styles={{ input: { fontSize: 12 } }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Controller
                            name={`entries.${index}.activityId`}
                            control={control}
                            render={({ field: f }) => (
                              <Select
                                value={f.value}
                                onChange={f.onChange}
                                data={activityOptions}
                                searchable
                                clearable
                                placeholder="Select..."
                                size="xs"
                                styles={{ input: { fontSize: 12 } }}
                              />
                            )}
                          />
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            {...register(`entries.${index}.comment`)}
                            size="xs"
                            placeholder="Comment..."
                            styles={{ input: { fontSize: 12 } }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            size="xs"
                            color="red"
                            variant="subtle"
                            onClick={() => remove(index)}
                            title="Remove row"
                          >
                            &times;
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>

              {/* Footer actions */}
              <Group justify="flex-end" pt="xs">
                <Button variant="default" onClick={handleClose}>
                  Close
                </Button>
                <Button type="submit" loading={saveMutation.isPending}>
                  Save
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      {/* Confirm close when dirty */}
      <Modal
        opened={confirmClose}
        onClose={closeConfirm}
        title="Unsaved changes"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">You have unsaved changes. Are you sure you want to close?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeConfirm}>
              Keep editing
            </Button>
            <Button color="red" onClick={handleConfirmedClose}>
              Discard changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
