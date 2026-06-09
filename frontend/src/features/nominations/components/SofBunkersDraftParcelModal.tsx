import { useEffect } from 'react';
import {
  Modal,
  Stack,
  Table,
  TextInput,
  Button,
  Group,
  Box,
  Text,
  ActionIcon,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from 'react-hook-form';
import { SofBunkersDataSchema, SofDraftDataSchema, SofParcelsDataSchema } from '@portlog/schemas';
import type { SofTimesheetResponse } from '@portlog/schemas';
import type { z } from 'zod';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';

function strToDateTime(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function dateTimeToStr(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 16);
}

type BunkersColKey = 'type' | 'arrival' | 'sailing' | 'lifted';
const BUNKERS_WIDTHS: Record<BunkersColKey, number> = {
  type: 120,
  arrival: 165,
  sailing: 165,
  lifted: 165,
};

type DraftColKey = 'type' | 'arrival' | 'sailing';
const DRAFT_WIDTHS: Record<DraftColKey, number> = { type: 120, arrival: 90, sailing: 90 };

const INITIAL_PARCELS_WIDTHS: Record<string, number> = { info: 180, 'col-0': 120 };

type SofBunkersData = z.infer<typeof SofBunkersDataSchema>;
type SofDraftData = z.infer<typeof SofDraftDataSchema>;
type SofParcelsData = z.infer<typeof SofParcelsDataSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BunkerRow {
  arrival: string;
  sailing: string;
  lifted: string;
}

interface DraftRow {
  arrival: string;
  sailing: string;
}

interface FormValues {
  bunkers: {
    IFO: BunkerRow;
    HSFO: BunkerRow;
    LSFO: BunkerRow;
    MDO: BunkerRow;
    MGO: BunkerRow;
    LSMGO: BunkerRow;
    FW: BunkerRow;
    VLSFO: BunkerRow;
  };
  draft: {
    FWD: DraftRow;
    AFT: DraftRow;
  };
  parcelsColumns: string[];
  parcelsRows: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUNKER_KEYS = ['IFO', 'HSFO', 'LSFO', 'MDO', 'MGO', 'LSMGO', 'FW', 'VLSFO'] as const;
const BUNKER_LABELS: Record<(typeof BUNKER_KEYS)[number], string> = {
  IFO: 'IFO (M/T)',
  HSFO: 'HSFO (M/T)',
  LSFO: 'LSFO (M/T)',
  MDO: 'MDO (M/T)',
  MGO: 'MGO (M/T)',
  LSMGO: 'LSMGO (M/T)',
  FW: 'FW (M/T)',
  VLSFO: 'VLSFO (M/T)',
};

const DRAFT_KEYS = ['FWD', 'AFT'] as const;
const DRAFT_LABELS: Record<(typeof DRAFT_KEYS)[number], string> = {
  FWD: 'Draft FWD (M)',
  AFT: 'Draft AFT (M)',
};

const PARCEL_ROW_KEYS = [
  'api',
  'temp',
  'numPumps',
  'qtyOfferedBblsHr',
  'qtyRequestedBblsHr',
  'qtyOfferedBbls',
  'qtyRequestedBbls',
] as const;

const PARCEL_ROW_LABELS: Record<(typeof PARCEL_ROW_KEYS)[number], string> = {
  api: 'API',
  temp: 'Temp. (Fahrenheit)',
  numPumps: 'Num. Pumps (Dish. O...)',
  qtyOfferedBblsHr: 'Qty. Offered (BBLS/HR)',
  qtyRequestedBblsHr: 'Qty. Requested (BBLS/HR)',
  qtyOfferedBbls: 'Qty. Offered (BBLS)',
  qtyRequestedBbls: 'Qty. Requested (BBLS)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyParcelsRows(cols: number): Record<string, string[]> {
  const rows: Record<string, string[]> = {};
  for (const key of PARCEL_ROW_KEYS) {
    rows[key] = Array(cols).fill('');
  }
  return rows;
}

function buildDefaultValues(sofData: SofTimesheetResponse | undefined): FormValues {
  const b = sofData?.bunkersData;
  const d = sofData?.draftData;
  const p = sofData?.sofParcelsData;

  const columns = p?.columns ?? [''];
  const parcelsRows: Record<string, string[]> = {};
  for (const key of PARCEL_ROW_KEYS) {
    const existing = p?.rows?.[key] ?? [];
    parcelsRows[key] = Array.from({ length: columns.length }, (_, i) => existing[i] ?? '');
  }

  return {
    bunkers: {
      IFO: {
        arrival: b?.IFO?.arrival ?? '',
        sailing: b?.IFO?.sailing ?? '',
        lifted: b?.IFO?.lifted ?? '',
      },
      HSFO: {
        arrival: b?.HSFO?.arrival ?? '',
        sailing: b?.HSFO?.sailing ?? '',
        lifted: b?.HSFO?.lifted ?? '',
      },
      LSFO: {
        arrival: b?.LSFO?.arrival ?? '',
        sailing: b?.LSFO?.sailing ?? '',
        lifted: b?.LSFO?.lifted ?? '',
      },
      MDO: {
        arrival: b?.MDO?.arrival ?? '',
        sailing: b?.MDO?.sailing ?? '',
        lifted: b?.MDO?.lifted ?? '',
      },
      MGO: {
        arrival: b?.MGO?.arrival ?? '',
        sailing: b?.MGO?.sailing ?? '',
        lifted: b?.MGO?.lifted ?? '',
      },
      LSMGO: {
        arrival: b?.LSMGO?.arrival ?? '',
        sailing: b?.LSMGO?.sailing ?? '',
        lifted: b?.LSMGO?.lifted ?? '',
      },
      FW: {
        arrival: b?.FW?.arrival ?? '',
        sailing: b?.FW?.sailing ?? '',
        lifted: b?.FW?.lifted ?? '',
      },
      VLSFO: {
        arrival: b?.VLSFO?.arrival ?? '',
        sailing: b?.VLSFO?.sailing ?? '',
        lifted: b?.VLSFO?.lifted ?? '',
      },
    },
    draft: {
      FWD: { arrival: d?.FWD?.arrival ?? '', sailing: d?.FWD?.sailing ?? '' },
      AFT: { arrival: d?.AFT?.arrival ?? '', sailing: d?.AFT?.sailing ?? '' },
    },
    parcelsColumns: columns,
    parcelsRows,
  };
}

function assemblePayload(vals: FormValues): {
  bunkersData: SofBunkersData;
  draftData: SofDraftData;
  sofParcelsData: SofParcelsData;
} {
  return {
    bunkersData: {
      IFO: vals.bunkers.IFO,
      HSFO: vals.bunkers.HSFO,
      LSFO: vals.bunkers.LSFO,
      MDO: vals.bunkers.MDO,
    },
    draftData: {
      FWD: vals.draft.FWD,
      AFT: vals.draft.AFT,
    },
    sofParcelsData: {
      columns: vals.parcelsColumns,
      rows: vals.parcelsRows,
    },
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SofBunkersDraftParcelModalProps {
  nominationId: string;
  opened: boolean;
  onClose: () => void;
  sofData: SofTimesheetResponse | undefined;
  onSave: (data: {
    bunkersData: SofBunkersData;
    draftData: SofDraftData;
    sofParcelsData: SofParcelsData;
  }) => void;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  onClear,
}: {
  title: string;
  onClear: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <Box bg="blue.6" px="xs" py={4} style={{ borderRadius: 4 }}>
      <Group justify="space-between">
        <Text c="white" fw={600} size="sm">
          {title}
        </Text>
        <Button size="xs" variant="white" color="blue" onClick={onClear} px={6} py={2}>
          Clear
        </Button>
      </Group>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SofBunkersDraftParcelModal({
  opened,
  onClose,
  sofData,
  onSave,
  isSaving,
}: SofBunkersDraftParcelModalProps) {
  const { register, handleSubmit, reset, getValues, setValue, watch } = useForm<FormValues>({
    defaultValues: buildDefaultValues(sofData),
  });
  const { colWidths: bunkersWidths, startResize: startBunkersResize } =
    useColumnResize<BunkersColKey>(BUNKERS_WIDTHS);
  const { colWidths: draftWidths, startResize: startDraftResize } =
    useColumnResize<DraftColKey>(DRAFT_WIDTHS);
  const {
    colWidths: parcelsWidths,
    setColWidths: setParcelsWidths,
    startResize: startParcelsResize,
  } = useColumnResize<string>(INITIAL_PARCELS_WIDTHS);

  useEffect(() => {
    if (opened) {
      reset(buildDefaultValues(sofData));
    }
  }, [opened, sofData, reset]);

  const parcelsColumns = watch('parcelsColumns');
  const parcelsRows = watch('parcelsRows');
  const bunkersValues = watch('bunkers');

  function clearBunkers() {
    for (const key of BUNKER_KEYS) {
      setValue(`bunkers.${key}.arrival`, '');
      setValue(`bunkers.${key}.sailing`, '');
      setValue(`bunkers.${key}.lifted`, '');
    }
  }

  function clearDraft() {
    for (const key of DRAFT_KEYS) {
      setValue(`draft.${key}.arrival`, '');
      setValue(`draft.${key}.sailing`, '');
    }
  }

  function clearParcels() {
    const cols = getValues('parcelsColumns');
    setValue('parcelsRows', emptyParcelsRows(cols.length));
  }

  function addParcelColumn() {
    const cols = getValues('parcelsColumns');
    const rows = getValues('parcelsRows');
    const newColKey = `col-${cols.length}`;
    setValue('parcelsColumns', [...cols, '']);
    const newRows: Record<string, string[]> = {};
    for (const key of PARCEL_ROW_KEYS) {
      newRows[key] = [...(rows[key] ?? []), ''];
    }
    setValue('parcelsRows', newRows);
    setParcelsWidths((prev) => ({ ...prev, [newColKey]: 120 }) as Record<string, number>);
  }

  function removeParcelColumn(colIndex: number) {
    const cols = getValues('parcelsColumns');
    const rows = getValues('parcelsRows');
    setValue(
      'parcelsColumns',
      cols.filter((_, i) => i !== colIndex),
    );
    const newRows: Record<string, string[]> = {};
    for (const key of PARCEL_ROW_KEYS) {
      newRows[key] = (rows[key] ?? []).filter((_, i) => i !== colIndex);
    }
    setValue('parcelsRows', newRows);
    setParcelsWidths((prev) => {
      const next = { ...prev };
      const colKeys = Object.keys(next)
        .filter((k) => k.startsWith('col-'))
        .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
      colKeys.forEach((k) => delete next[k]);
      const remaining = colKeys.filter((_, i) => i !== colIndex);
      remaining.forEach((k, i) => {
        next[`col-${i}`] = prev[k]!;
      });
      return next as Record<string, number>;
    });
  }

  function onSubmit(vals: FormValues) {
    onSave(assemblePayload(vals));
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Bunkers / Draft / Parcel"
      closeOnClickOutside={false}
      size="70vw"
      styles={{ content: { resize: 'both', overflow: 'auto', width: '100%', minWidth: 400 } }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          {/* Bunkers */}
          <Stack gap={6}>
            <SectionHeader title="Bunkers" onClear={clearBunkers} />
            <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <ResizableTh
                    width={bunkersWidths.type}
                    onResize={(e) => startBunkersResize('type', e)}
                  >
                    Type
                  </ResizableTh>
                  <ResizableTh
                    width={bunkersWidths.arrival}
                    onResize={(e) => startBunkersResize('arrival', e)}
                  >
                    Arrival
                  </ResizableTh>
                  <ResizableTh
                    width={bunkersWidths.sailing}
                    onResize={(e) => startBunkersResize('sailing', e)}
                  >
                    Sailing
                  </ResizableTh>
                  <ResizableTh
                    width={bunkersWidths.lifted}
                    onResize={(e) => startBunkersResize('lifted', e)}
                  >
                    Lifted
                  </ResizableTh>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {BUNKER_KEYS.map((key) => (
                  <Table.Tr key={key}>
                    <Table.Td style={{ width: bunkersWidths.type }}>
                      <Text size="sm">{BUNKER_LABELS[key]}</Text>
                    </Table.Td>
                    <Table.Td style={{ width: bunkersWidths.arrival }}>
                      <DateTimePicker
                        size="xs"
                        valueFormat="DD/MM/YYYY HH:mm"
                        clearable
                        styles={{ input: { fontSize: 12 } }}
                        value={strToDateTime(bunkersValues[key].arrival ?? '')}
                        onChange={(d) => setValue(`bunkers.${key}.arrival`, dateTimeToStr(d))}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: bunkersWidths.sailing }}>
                      <DateTimePicker
                        size="xs"
                        valueFormat="DD/MM/YYYY HH:mm"
                        clearable
                        styles={{ input: { fontSize: 12 } }}
                        value={strToDateTime(bunkersValues[key].sailing ?? '')}
                        onChange={(d) => setValue(`bunkers.${key}.sailing`, dateTimeToStr(d))}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: bunkersWidths.lifted }}>
                      <DateTimePicker
                        size="xs"
                        valueFormat="DD/MM/YYYY HH:mm"
                        clearable
                        styles={{ input: { fontSize: 12 } }}
                        value={strToDateTime(bunkersValues[key].lifted ?? '')}
                        onChange={(d) => setValue(`bunkers.${key}.lifted`, dateTimeToStr(d))}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>

          {/* Draft */}
          <Stack gap={6}>
            <SectionHeader title="Draft" onClear={clearDraft} />
            <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <ResizableTh
                    width={draftWidths.type}
                    onResize={(e) => startDraftResize('type', e)}
                  >
                    Type
                  </ResizableTh>
                  <ResizableTh
                    width={draftWidths.arrival}
                    onResize={(e) => startDraftResize('arrival', e)}
                  >
                    Arrival
                  </ResizableTh>
                  <ResizableTh
                    width={draftWidths.sailing}
                    onResize={(e) => startDraftResize('sailing', e)}
                  >
                    Sailing
                  </ResizableTh>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {DRAFT_KEYS.map((key) => (
                  <Table.Tr key={key}>
                    <Table.Td style={{ width: draftWidths.type }}>
                      <Text size="sm">{DRAFT_LABELS[key]}</Text>
                    </Table.Td>
                    <Table.Td style={{ width: draftWidths.arrival }}>
                      <TextInput
                        {...register(`draft.${key}.arrival`)}
                        size="xs"
                        styles={{ input: { fontSize: 12 } }}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: draftWidths.sailing }}>
                      <TextInput
                        {...register(`draft.${key}.sailing`)}
                        size="xs"
                        styles={{ input: { fontSize: 12 } }}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>

          {/* Parcels */}
          <Stack gap={6}>
            <Box bg="blue.6" px="xs" py={4} style={{ borderRadius: 4 }}>
              <Group justify="space-between">
                <Text c="white" fw={600} size="sm">
                  Parcels
                </Text>
                <Group gap={6}>
                  <ActionIcon
                    size="xs"
                    variant="white"
                    color="blue"
                    onClick={addParcelColumn}
                    title="Add cargo column"
                  >
                    +
                  </ActionIcon>
                  <Button
                    size="xs"
                    variant="white"
                    color="blue"
                    onClick={clearParcels}
                    px={6}
                    py={2}
                  >
                    Clear
                  </Button>
                </Group>
              </Group>
            </Box>

            <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <ResizableTh
                    width={parcelsWidths['info'] ?? 180}
                    onResize={(e) => startParcelsResize('info', e)}
                  >
                    Info
                  </ResizableTh>
                  {parcelsColumns.map((_, colIndex) => (
                    <ResizableTh
                      key={colIndex}
                      width={parcelsWidths[`col-${colIndex}`] ?? 120}
                      onResize={(e) => startParcelsResize(`col-${colIndex}`, e)}
                    >
                      <Group gap={4} wrap="nowrap">
                        <TextInput
                          {...register(`parcelsColumns.${colIndex}`)}
                          size="xs"
                          placeholder="Cargo name"
                          styles={{ input: { fontSize: 12 } }}
                        />
                        <ActionIcon
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={() => removeParcelColumn(colIndex)}
                          title="Remove column"
                        >
                          &times;
                        </ActionIcon>
                      </Group>
                    </ResizableTh>
                  ))}
                  {parcelsColumns.length === 0 && (
                    <Table.Th>
                      <Text size="xs" c="dimmed">
                        No columns. Click + to add.
                      </Text>
                    </Table.Th>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {PARCEL_ROW_KEYS.map((rowKey) => (
                  <Table.Tr key={rowKey}>
                    <Table.Td style={{ width: parcelsWidths['info'] ?? 180 }}>
                      <Text size="sm">{PARCEL_ROW_LABELS[rowKey]}</Text>
                    </Table.Td>
                    {parcelsColumns.map((_, colIndex) => (
                      <Table.Td
                        key={colIndex}
                        style={{ width: parcelsWidths[`col-${colIndex}`] ?? 120 }}
                      >
                        <TextInput
                          value={parcelsRows[rowKey]?.[colIndex] ?? ''}
                          onChange={(e) => {
                            const rows = getValues('parcelsRows');
                            const updated = [...(rows[rowKey] ?? [])];
                            updated[colIndex] = e.currentTarget.value;
                            setValue(`parcelsRows.${rowKey}`, updated);
                          }}
                          size="xs"
                          styles={{ input: { fontSize: 12 } }}
                        />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>

          {/* Footer */}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} disabled={isSaving}>
              Close
            </Button>
            <Button variant="default" type="submit" loading={isSaving}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
