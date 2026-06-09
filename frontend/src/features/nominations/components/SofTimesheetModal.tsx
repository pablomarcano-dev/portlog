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
  Divider,
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';
import { useNominationSof, useNominationSofSave } from '../hooks/useNominationSof';
import { useActivities } from '../../../lib/api/master-data/activities';
import type { SofTimesheetResponse } from '@portlog/schemas';
import { SofBunkersDraftParcelModal } from './SofBunkersDraftParcelModal';
import { SofBillShipFiguresModal } from './SofBillShipFiguresModal';
import { SofLettersRemarksModal } from './SofLettersRemarksModal';
import { SofSlopBunkersReceivedModal } from './SofSlopBunkersReceivedModal';
import { EmailComposeDrawer } from './EmailComposeDrawer';
import { useNominationCompose } from '../api/useNominationCompose';

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
  pedrId?: string;
  opPortId?: string | null;
  opened: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SofTimesheetModal({
  nominationId,
  pedrId,
  opPortId,
  opened,
  onClose,
}: SofTimesheetModalProps) {
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

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'entries' });

  type ColKey = 'date' | 'time' | 'activity' | 'comment' | 'actions';
  const INITIAL_WIDTHS: Record<ColKey, number> = {
    date: 130,
    time: 80,
    activity: 200,
    comment: 250,
    actions: 40,
  };
  const { colWidths, startResize } = useColumnResize<ColKey>(INITIAL_WIDTHS);

  function sortEntries() {
    const current = form.getValues('entries');
    const sorted = [...current].sort((a, b) => {
      const aIso = combineDateTime(a.date, a.time);
      const bIso = combineDateTime(b.date, b.time);
      if (!aIso && !bIso) return 0;
      if (!aIso) return 1;
      if (!bIso) return -1;
      return aIso < bIso ? -1 : aIso > bIso ? 1 : 0;
    });
    replace(sorted);
  }

  // SOF email compose
  const [sofEmailOpen, { open: openSofEmail, close: closeSofEmail }] = useDisclosure(false);
  const { data: sofComposeData } = useNominationCompose(pedrId ? nominationId : undefined, 'SOF');

  // Dirty check for close confirmation
  const [confirmClose, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  // Sub-modal open states
  const [bunkersDraftParcelOpen, { open: openBunkersDraftParcel, close: closeBunkersDraftParcel }] =
    useDisclosure(false);
  const [billShipFiguresOpen, { open: openBillShipFigures, close: closeBillShipFigures }] =
    useDisclosure(false);
  const [lettersRemarksOpen, { open: openLettersRemarks, close: closeLettersRemarks }] =
    useDisclosure(false);
  const [slopBunkersOpen, { open: openSlopBunkers, close: closeSlopBunkers }] =
    useDisclosure(false);

  function buildBasePayload() {
    const vals = form.getValues();
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
    return {
      lastPortId: vals.lastPortId ?? null,
      nextPortId: vals.nextPortId ?? null,
      pierId: vals.pierId ?? null,
      captain: vals.captain || null,
      mobileOnBoard: vals.mobileOnBoard || null,
      entries,
      bunkersData: sofData?.bunkersData ?? undefined,
      draftData: sofData?.draftData ?? undefined,
      sofParcelsData: sofData?.sofParcelsData ?? undefined,
      blFiguresData: sofData?.blFiguresData ?? undefined,
      shipFiguresData: sofData?.shipFiguresData ?? undefined,
      lettersData: sofData?.lettersData ?? undefined,
      remarksData: sofData?.remarksData ?? undefined,
      slopDischargedData: sofData?.slopDischargedData ?? undefined,
      bunkersReceivedData: sofData?.bunkersReceivedData ?? undefined,
    };
  }

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
        closeOnClickOutside={false}
        size="70vw"
        styles={{
          content: {
            resize: 'both',
            overflow: 'auto',
            width: '100%',
            minWidth: 400,
          },
        }}
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
                        endpoint={
                          opPortId ? `/master-data/ports/${opPortId}/piers` : '/master-data/ports'
                        }
                        label="Berth"
                        value={field.value}
                        onChange={field.onChange}
                        searchValue={pierSearch}
                        onSearchChange={setPierSearch}
                        placeholder={opPortId ? 'Search piers...' : 'No op. port set'}
                        disabled={!opPortId}
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
                <Box bg="blue.6" px="sm" py="xs" mb={0}>
                  <Group justify="space-between">
                    <Text fw={600} size="sm" c="white">
                      Times Sheet
                    </Text>
                    <Group gap="xs">
                      <Button size="xs" variant="white" onClick={handleInsert}>
                        Insert
                      </Button>
                      <Button
                        size="xs"
                        variant="white"
                        color="red"
                        onClick={handleDelete}
                        disabled={fields.length === 0}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Group>
                </Box>

                <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
                  <Table.Thead>
                    <Table.Tr>
                      <ResizableTh width={colWidths.date} onResize={(e) => startResize('date', e)}>
                        Date
                      </ResizableTh>
                      <ResizableTh width={colWidths.time} onResize={(e) => startResize('time', e)}>
                        Time
                      </ResizableTh>
                      <ResizableTh
                        width={colWidths.activity}
                        onResize={(e) => startResize('activity', e)}
                      >
                        Activity
                      </ResizableTh>
                      <ResizableTh
                        width={colWidths.comment}
                        onResize={(e) => startResize('comment', e)}
                      >
                        Comment
                      </ResizableTh>
                      <ResizableTh
                        width={colWidths.actions}
                        onResize={(e) => startResize('actions', e)}
                      />
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
                        <Table.Td style={{ width: colWidths.date }}>
                          <Controller
                            name={`entries.${index}.date`}
                            control={control}
                            render={({ field: f }) => (
                              <DatePickerInput
                                value={f.value}
                                onChange={(val) => {
                                  f.onChange(val);
                                  sortEntries();
                                }}
                                placeholder="Date"
                                size="xs"
                                clearable
                                valueFormat="DD/MM/YYYY"
                                styles={{ input: { fontSize: 12 } }}
                              />
                            )}
                          />
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.time }}>
                          <TimeInput
                            {...register(`entries.${index}.time`)}
                            onBlur={sortEntries}
                            size="xs"
                            styles={{ input: { fontSize: 12 } }}
                          />
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.activity }}>
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
                        <Table.Td style={{ width: colWidths.comment }}>
                          <TextInput
                            {...register(`entries.${index}.comment`)}
                            size="xs"
                            placeholder="Comment..."
                            styles={{ input: { fontSize: 12 } }}
                          />
                        </Table.Td>
                        <Table.Td style={{ width: colWidths.actions }}>
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
              <Divider />
              <Group justify="space-between" mt="xs">
                <Group gap="xs">
                  {pedrId && (
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      onClick={openSofEmail}
                      disabled={saveMutation.isPending}
                    >
                      Send SOF Email
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="default"
                    onClick={openBunkersDraftParcel}
                    disabled={saveMutation.isPending}
                  >
                    Bunkers/Draft/Parcel
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={openBillShipFigures}
                    disabled={saveMutation.isPending}
                  >
                    Bill Fig./Ship Fig.
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={openLettersRemarks}
                    disabled={saveMutation.isPending}
                  >
                    Letters/Remarks
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={openSlopBunkers}
                    disabled={saveMutation.isPending}
                  >
                    Slop/B. Received
                  </Button>
                </Group>
                <Group gap="xs">
                  <Button variant="default" onClick={handleClose} disabled={saveMutation.isPending}>
                    Close
                  </Button>
                  <Button variant="default" type="submit" loading={saveMutation.isPending}>
                    Save
                  </Button>
                </Group>
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

      <SofBunkersDraftParcelModal
        nominationId={nominationId}
        opened={bunkersDraftParcelOpen}
        onClose={closeBunkersDraftParcel}
        sofData={sofData}
        isSaving={saveMutation.isPending}
        onSave={(data) => {
          saveMutation.mutate({ ...buildBasePayload(), ...data });
        }}
      />

      <SofBillShipFiguresModal
        nominationId={nominationId}
        opened={billShipFiguresOpen}
        onClose={closeBillShipFigures}
        sofData={sofData}
        isSaving={saveMutation.isPending}
        onSave={(data) => {
          saveMutation.mutate({ ...buildBasePayload(), ...data });
        }}
      />

      <SofLettersRemarksModal
        nominationId={nominationId}
        opened={lettersRemarksOpen}
        onClose={closeLettersRemarks}
        sofData={sofData}
        isSaving={saveMutation.isPending}
        onSave={(data) => {
          saveMutation.mutate({ ...buildBasePayload(), ...data });
        }}
      />

      <SofSlopBunkersReceivedModal
        nominationId={nominationId}
        opened={slopBunkersOpen}
        onClose={closeSlopBunkers}
        sofData={sofData}
        isSaving={saveMutation.isPending}
        onSave={(data) => {
          saveMutation.mutate({ ...buildBasePayload(), ...data });
        }}
      />

      {pedrId && (
        <EmailComposeDrawer
          opened={sofEmailOpen}
          onClose={closeSofEmail}
          pedrId={pedrId}
          nominationId={nominationId}
          subDocType="SOF"
          defaultSubject={sofComposeData?.subject ?? ''}
          defaultBody={sofComposeData?.bodyHtml}
        />
      )}
    </>
  );
}
