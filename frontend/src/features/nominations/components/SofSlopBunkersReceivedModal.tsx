import { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  TextInput,
  Button,
  Group,
  Stack,
  Text,
  Box,
  ActionIcon,
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import type {
  SofTimesheetResponse,
  SofSlopDischargedData,
  SofBunkersReceivedData,
} from '@portlog/schemas';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';

type SlopColKey = 'date' | 'time' | 'event';
const SLOP_WIDTHS: Record<SlopColKey, number> = { date: 130, time: 80, event: 300 };

const INITIAL_BUNKERS_WIDTHS: Record<string, number> = {
  event: 200,
  'grade-0': 100,
  'grade-1': 100,
  water: 80,
};

function strToDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function dateToStr(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SLOP_EVENTS = [
  'Slop hose(s) / Arm(s) Connected - No. & Size',
  'Commenced Slops Discharge',
  'Completed Slops Discharge, Quantity & Type',
  'Last Slop Arm / Hose Disconnected',
];

const BUNKER_EVENTS = [
  'Delivery Method :',
  'Arm/Hose Connected :',
  'Commenced :',
  'Completed :',
  'Arm/Hose Disconnected :',
  'Quantity Received :',
];

function buildDefaultSlop(data: SofTimesheetResponse | undefined): SofSlopDischargedData {
  if (data?.slopDischargedData?.rows && data.slopDischargedData.rows.length > 0) {
    return data.slopDischargedData;
  }
  return {
    rows: SLOP_EVENTS.map((event) => ({ event, date: '', time: '' })),
  };
}

function buildDefaultBunkers(data: SofTimesheetResponse | undefined): SofBunkersReceivedData {
  if (data?.bunkersReceivedData?.rows && data.bunkersReceivedData.rows.length > 0) {
    return data.bunkersReceivedData;
  }
  return {
    columns: ['Grade 1', 'Grade 2'],
    rows: BUNKER_EVENTS.map((event) => ({ event, values: ['', ''], water: '' })),
  };
}

interface SofSlopBunkersReceivedModalProps {
  nominationId: string;
  opened: boolean;
  onClose: () => void;
  sofData: SofTimesheetResponse | undefined;
  onSave: (data: {
    slopDischargedData: SofSlopDischargedData;
    bunkersReceivedData: SofBunkersReceivedData;
  }) => void;
  isSaving: boolean;
}

export function SofSlopBunkersReceivedModal({
  opened,
  onClose,
  sofData,
  onSave,
  isSaving,
}: SofSlopBunkersReceivedModalProps) {
  const [slop, setSlop] = useState<SofSlopDischargedData>(() => buildDefaultSlop(sofData));
  const [bunkers, setBunkers] = useState<SofBunkersReceivedData>(() =>
    buildDefaultBunkers(sofData),
  );
  const { colWidths: slopWidths, startResize: startSlopResize } =
    useColumnResize<SlopColKey>(SLOP_WIDTHS);
  const {
    colWidths: bunkersColWidths,
    setColWidths: setBunkersColWidths,
    startResize: startBunkersResize,
  } = useColumnResize<string>(INITIAL_BUNKERS_WIDTHS);

  useEffect(() => {
    if (opened) {
      setSlop(buildDefaultSlop(sofData));
      setBunkers(buildDefaultBunkers(sofData));
    }
  }, [opened, sofData]);

  function updateSlopRow(rowIdx: number, field: 'date' | 'time', value: string) {
    setSlop((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r)),
    }));
  }

  function clearSlop() {
    setSlop((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => ({ ...r, date: '', time: '' })),
    }));
  }

  function updateBunkersCell(rowIdx: number, colIdx: number, value: string) {
    setBunkers((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) =>
        i === rowIdx ? { ...r, values: r.values.map((v, j) => (j === colIdx ? value : v)) } : r,
      ),
    }));
  }

  function updateBunkersWater(rowIdx: number, value: string) {
    setBunkers((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => (i === rowIdx ? { ...r, water: value } : r)),
    }));
  }

  function clearBunkers() {
    setBunkers((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => ({ ...r, values: r.values.map(() => ''), water: '' })),
    }));
  }

  function addGradeColumn() {
    const newColName = `Grade ${bunkers.columns.length + 1}`;
    const newGradeKey = `grade-${bunkers.columns.length}`;
    setBunkers((prev) => ({
      columns: [...prev.columns, newColName],
      rows: prev.rows.map((r) => ({ ...r, values: [...r.values, ''] })),
    }));
    setBunkersColWidths((prev) => ({ ...prev, [newGradeKey]: 100 }) as Record<string, number>);
  }

  function removeGradeColumn(colIdx: number) {
    setBunkers((prev) => ({
      columns: prev.columns.filter((_, i) => i !== colIdx),
      rows: prev.rows.map((r) => ({
        ...r,
        values: r.values.filter((_, i) => i !== colIdx),
      })),
    }));
    setBunkersColWidths((prev) => {
      const next = { ...prev };
      // remove the grade key at colIdx, then renumber remaining grade keys
      const gradeKeys = Object.keys(next)
        .filter((k) => k.startsWith('grade-'))
        .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
      gradeKeys.forEach((k) => delete next[k]);
      const remaining = gradeKeys.filter((_, i) => i !== colIdx);
      remaining.forEach((k, i) => {
        next[`grade-${i}`] = prev[k]!;
      });
      return next as Record<string, number>;
    });
  }

  function handleSave() {
    onSave({ slopDischargedData: slop, bunkersReceivedData: bunkers });
    onClose();
  }

  const inputStyles = { input: { fontSize: 12 } };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Slop Discharged / Bunkers Received"
      closeOnClickOutside={false}
      size="70vw"
      styles={{ content: { resize: 'both', overflow: 'auto', width: '100%', minWidth: 400 } }}
    >
      <Stack gap="md">
        <Stack gap={0}>
          <Box bg="blue.6" c="white" px="sm" py="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                Slop Discharged
              </Text>
              <Button size="xs" variant="white" color="blue" onClick={clearSlop}>
                Clear
              </Button>
            </Group>
          </Box>
          <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh width={slopWidths.date} onResize={(e) => startSlopResize('date', e)}>
                  Date
                </ResizableTh>
                <ResizableTh width={slopWidths.time} onResize={(e) => startSlopResize('time', e)}>
                  Time
                </ResizableTh>
                <ResizableTh width={slopWidths.event} onResize={(e) => startSlopResize('event', e)}>
                  Event
                </ResizableTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {slop.rows.map((row, i) => (
                <Table.Tr key={i}>
                  <Table.Td style={{ width: slopWidths.date }}>
                    <DatePickerInput
                      size="xs"
                      valueFormat="DD/MM/YYYY"
                      clearable
                      styles={inputStyles}
                      value={strToDate(row.date)}
                      onChange={(d) => updateSlopRow(i, 'date', dateToStr(d))}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: slopWidths.time }}>
                    <TimeInput
                      size="xs"
                      styles={inputStyles}
                      value={row.time}
                      onChange={(e) => updateSlopRow(i, 'time', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: slopWidths.event }}>
                    <Text size="xs">{row.event}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>

        <Stack gap={0}>
          <Box bg="blue.6" c="white" px="sm" py="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                Bunkers Received
              </Text>
              <Group gap="xs">
                <ActionIcon
                  size="xs"
                  variant="white"
                  color="blue"
                  onClick={addGradeColumn}
                  title="Add grade column"
                >
                  +
                </ActionIcon>
                <Button size="xs" variant="white" color="blue" onClick={clearBunkers}>
                  Clear
                </Button>
              </Group>
            </Group>
          </Box>
          <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh
                  width={bunkersColWidths['event'] ?? 200}
                  onResize={(e) => startBunkersResize('event', e)}
                >
                  Event
                </ResizableTh>
                {bunkers.columns.map((col, ci) => (
                  <ResizableTh
                    key={ci}
                    width={bunkersColWidths[`grade-${ci}`] ?? 100}
                    onResize={(e) => startBunkersResize(`grade-${ci}`, e)}
                  >
                    <Group gap={4} wrap="nowrap">
                      <Text size="xs">{col}</Text>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => removeGradeColumn(ci)}
                        title={`Remove ${col}`}
                      >
                        ×
                      </ActionIcon>
                    </Group>
                  </ResizableTh>
                ))}
                <ResizableTh
                  width={bunkersColWidths['water'] ?? 80}
                  onResize={(e) => startBunkersResize('water', e)}
                >
                  Water
                </ResizableTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {bunkers.rows.map((row, ri) => (
                <Table.Tr key={ri}>
                  <Table.Td style={{ width: bunkersColWidths['event'] ?? 200 }}>
                    <Text size="xs">{row.event}</Text>
                  </Table.Td>
                  {bunkers.columns.map((_, ci) => (
                    <Table.Td key={ci} style={{ width: bunkersColWidths[`grade-${ci}`] ?? 100 }}>
                      <TextInput
                        size="xs"
                        styles={inputStyles}
                        value={row.values[ci] ?? ''}
                        onChange={(e) => updateBunkersCell(ri, ci, e.currentTarget.value)}
                      />
                    </Table.Td>
                  ))}
                  <Table.Td style={{ width: bunkersColWidths['water'] ?? 80 }}>
                    <TextInput
                      size="xs"
                      styles={inputStyles}
                      value={row.water}
                      onChange={(e) => updateBunkersWater(ri, e.currentTarget.value)}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
