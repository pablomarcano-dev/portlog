import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Table,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Box,
  Text,
  SimpleGrid,
  Paper,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  calculateSofOperations,
  formatSofDuration,
  type SofTimesheetResponse,
  type SofLettersData,
  type SofRemarksData,
  type SofDelayCategory,
} from '@portlog/schemas';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';

type LettersColKey = 'num' | 'from' | 'to' | 'comment';
const LETTERS_WIDTHS: Record<LettersColKey, number> = { num: 40, from: 120, to: 120, comment: 200 };

type RemarksColKey = 'num' | 'category' | 'remark' | 'begin' | 'end' | 'duration' | 'comment';
const REMARKS_WIDTHS: Record<RemarksColKey, number> = {
  num: 40,
  category: 135,
  remark: 140,
  begin: 165,
  end: 165,
  duration: 90,
  comment: 180,
};

function strToDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  const combined = time ? `${date}T${time}:00` : `${date}T00:00:00`;
  const d = new Date(combined);
  return isNaN(d.getTime()) ? null : d;
}

function dateTimeToDateStr(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateTimeToTimeStr(d: Date | null): string {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface SofLettersRemarksModalProps {
  nominationId: string;
  opened: boolean;
  onClose: () => void;
  sofData: SofTimesheetResponse | undefined;
  onSave: (data: { lettersData: SofLettersData; remarksData: SofRemarksData }) => void;
  isSaving: boolean;
}

type LetterRow = { from: string; to: string; comment: string };
type RemarkRow = {
  delayCategory: SofDelayCategory | null;
  remark: string;
  beginDate: string;
  beginTime: string;
  endDate: string;
  endTime: string;
  comment: string;
};

const INPUT_STYLES = { input: { fontSize: 12 } } as const;

const LETTER_PARTY_OPTIONS = ['Master', 'Shore', 'Surveyor', 'Bunker Supplier', 'Bunker Vessel'];

const EMPTY_LETTER = (): LetterRow => ({ from: '', to: '', comment: '' });
const EMPTY_REMARK = (): RemarkRow => ({
  delayCategory: null,
  remark: '',
  beginDate: '',
  beginTime: '',
  endDate: '',
  endTime: '',
  comment: '',
});

const DELAY_OPTIONS = [
  { value: 'BEFORE', label: 'Before Operations' },
  { value: 'DURING', label: 'During Operations' },
  { value: 'AFTER', label: 'After Operations' },
];

export function SofLettersRemarksModal({
  opened,
  onClose,
  sofData,
  onSave,
  isSaving,
}: SofLettersRemarksModalProps) {
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [remarks, setRemarks] = useState<RemarkRow[]>([]);
  const [cargoQuantity, setCargoQuantity] = useState('');
  const [obq, setObq] = useState('');
  const { colWidths: lettersWidths, startResize: startLettersResize } =
    useColumnResize<LettersColKey>(LETTERS_WIDTHS);
  const { colWidths: remarksWidths, startResize: startRemarksResize } =
    useColumnResize<RemarksColKey>(REMARKS_WIDTHS);

  useEffect(() => {
    if (opened) {
      setLetters(sofData?.lettersData?.items?.map((i) => ({ ...i })) ?? []);
      setRemarks(sofData?.remarksData?.items?.map((i) => ({ ...i })) ?? []);
      setCargoQuantity(sofData?.remarksData?.cargoQuantity ?? '');
      setObq(sofData?.remarksData?.obq ?? '');
    }
  }, [opened]);

  function updateLetter(idx: number, field: keyof LetterRow, value: string) {
    setLetters((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function updateRemark<K extends keyof RemarkRow>(idx: number, field: K, value: RemarkRow[K]) {
    setRemarks((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function handleSave() {
    onSave({
      lettersData: { items: letters },
      remarksData: { items: remarks, cargoQuantity, obq },
    });
    onClose();
  }

  const summary = useMemo(
    () => calculateSofOperations(sofData?.entries ?? [], remarks, cargoQuantity, obq),
    [sofData?.entries, remarks, cargoQuantity, obq],
  );

  const remarkDuration = (row: RemarkRow) => {
    const begin = strToDateTime(row.beginDate, row.beginTime)?.getTime();
    const end = strToDateTime(row.endDate, row.endTime)?.getTime();
    return begin != null && end != null && end >= begin ? formatSofDuration(end - begin) : '—';
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Letters of protest / Remarks"
      size="70vw"
      styles={{ content: { resize: 'both', overflow: 'auto', width: '100%', minWidth: 400 } }}
    >
      <Stack gap="md">
        {/* Letters section */}
        <Box>
          <Box bg="blue.6" px="sm" py="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm" c="white">
                Letters
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="white"
                  onClick={() => setLetters((p) => [...p, EMPTY_LETTER()])}
                >
                  Insert
                </Button>
                <Button
                  size="xs"
                  variant="white"
                  onClick={() => setLetters((p) => p.slice(0, -1))}
                  disabled={letters.length === 0}
                >
                  Delete
                </Button>
              </Group>
            </Group>
          </Box>
          <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh
                  width={lettersWidths.num}
                  onResize={(e) => startLettersResize('num', e)}
                >
                  #
                </ResizableTh>
                <ResizableTh
                  width={lettersWidths.from}
                  onResize={(e) => startLettersResize('from', e)}
                >
                  From
                </ResizableTh>
                <ResizableTh width={lettersWidths.to} onResize={(e) => startLettersResize('to', e)}>
                  To
                </ResizableTh>
                <ResizableTh
                  width={lettersWidths.comment}
                  onResize={(e) => startLettersResize('comment', e)}
                >
                  Comment
                </ResizableTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {letters.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="xs" c="dimmed" ta="center">
                      No letters. Click Insert to add a row.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {letters.map((row, idx) => (
                <Table.Tr key={idx}>
                  <Table.Td style={{ width: lettersWidths.num }}>
                    <Text size="xs" ta="center">
                      {idx + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ width: lettersWidths.from }}>
                    <Select
                      size="xs"
                      styles={INPUT_STYLES}
                      data={LETTER_PARTY_OPTIONS}
                      value={row.from}
                      onChange={(value) => updateLetter(idx, 'from', value ?? '')}
                      clearable
                    />
                  </Table.Td>
                  <Table.Td style={{ width: lettersWidths.to }}>
                    <Select
                      size="xs"
                      styles={INPUT_STYLES}
                      data={LETTER_PARTY_OPTIONS}
                      value={row.to}
                      onChange={(value) => updateLetter(idx, 'to', value ?? '')}
                      clearable
                    />
                  </Table.Td>
                  <Table.Td style={{ width: lettersWidths.comment }}>
                    <TextInput
                      size="xs"
                      styles={INPUT_STYLES}
                      value={row.comment}
                      onChange={(e) => updateLetter(idx, 'comment', e.currentTarget.value)}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        {/* Remarks section */}
        <Box>
          <Box bg="blue.6" px="sm" py="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm" c="white">
                Remarks
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="white"
                  onClick={() => setRemarks((p) => [...p, EMPTY_REMARK()])}
                >
                  Insert
                </Button>
                <Button
                  size="xs"
                  variant="white"
                  onClick={() => setRemarks((p) => p.slice(0, -1))}
                  disabled={remarks.length === 0}
                >
                  Delete
                </Button>
              </Group>
            </Group>
          </Box>
          <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh
                  width={remarksWidths.num}
                  onResize={(e) => startRemarksResize('num', e)}
                >
                  #
                </ResizableTh>
                <ResizableTh
                  width={remarksWidths.category}
                  onResize={(e) => startRemarksResize('category', e)}
                >
                  Delay Type
                </ResizableTh>
                <ResizableTh
                  width={remarksWidths.remark}
                  onResize={(e) => startRemarksResize('remark', e)}
                >
                  Remark
                </ResizableTh>
                <ResizableTh
                  width={remarksWidths.begin}
                  onResize={(e) => startRemarksResize('begin', e)}
                >
                  Begin
                </ResizableTh>
                <ResizableTh
                  width={remarksWidths.end}
                  onResize={(e) => startRemarksResize('end', e)}
                >
                  End
                </ResizableTh>
                <ResizableTh
                  width={remarksWidths.duration}
                  onResize={(e) => startRemarksResize('duration', e)}
                >
                  Duration
                </ResizableTh>
                <ResizableTh
                  width={remarksWidths.comment}
                  onResize={(e) => startRemarksResize('comment', e)}
                >
                  Comment
                </ResizableTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {remarks.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text size="xs" c="dimmed" ta="center">
                      No remarks. Click Insert to add a row.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {remarks.map((row, idx) => (
                <Table.Tr key={idx}>
                  <Table.Td style={{ width: remarksWidths.num }}>
                    <Text size="xs" ta="center">
                      {idx + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ width: remarksWidths.category }}>
                    <Select
                      size="xs"
                      data={DELAY_OPTIONS}
                      value={row.delayCategory}
                      onChange={(value) =>
                        updateRemark(idx, 'delayCategory', (value as SofDelayCategory) ?? null)
                      }
                      placeholder="Classify"
                      clearable
                    />
                  </Table.Td>
                  <Table.Td style={{ width: remarksWidths.remark }}>
                    <TextInput
                      size="xs"
                      styles={INPUT_STYLES}
                      value={row.remark}
                      onChange={(e) => updateRemark(idx, 'remark', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: remarksWidths.begin }}>
                    <DateTimePicker
                      size="xs"
                      valueFormat="DD/MM/YYYY HH:mm"
                      clearable
                      styles={INPUT_STYLES}
                      value={strToDateTime(row.beginDate, row.beginTime)}
                      onChange={(d) =>
                        setRemarks((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  beginDate: dateTimeToDateStr(d),
                                  beginTime: dateTimeToTimeStr(d),
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  </Table.Td>
                  <Table.Td style={{ width: remarksWidths.end }}>
                    <DateTimePicker
                      size="xs"
                      valueFormat="DD/MM/YYYY HH:mm"
                      clearable
                      styles={INPUT_STYLES}
                      value={strToDateTime(row.endDate, row.endTime)}
                      onChange={(d) =>
                        setRemarks((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  endDate: dateTimeToDateStr(d),
                                  endTime: dateTimeToTimeStr(d),
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  </Table.Td>
                  <Table.Td style={{ width: remarksWidths.duration }}>
                    <Text size="xs" fw={600} ta="center">
                      {remarkDuration(row)}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ width: remarksWidths.comment }}>
                    <TextInput
                      size="xs"
                      styles={INPUT_STYLES}
                      value={row.comment}
                      onChange={(e) => updateRemark(idx, 'comment', e.currentTarget.value)}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Paper withBorder p="md" mt="md" bg="gray.0">
            <Group justify="space-between" align="flex-end" mb="md">
              <div>
                <Text fw={700}>Operational Time Calculation</Text>
                <Text size="xs" c="dimmed">
                  Calculated from Times Sheet activities and classified remarks.
                </Text>
              </div>
              <Group grow w={360}>
                <TextInput
                  label="Cargo quantity"
                  value={cargoQuantity}
                  onChange={(e) => setCargoQuantity(e.currentTarget.value)}
                  placeholder="e.g. 100,000"
                />
                <TextInput
                  label="OBQ"
                  value={obq}
                  onChange={(e) => setObq(e.currentTarget.value)}
                  placeholder="e.g. 1,000"
                />
              </Group>
            </Group>
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xs">
              {[
                ['Turnaround', formatSofDuration(summary.turnaroundMs)],
                ['Laytime', formatSofDuration(summary.laytimeMs)],
                ['Gross operation', formatSofDuration(summary.grossOperationMs)],
                ['Delay before', formatSofDuration(summary.delaysBeforeMs)],
                ['Delay during', formatSofDuration(summary.delaysDuringMs)],
                ['Delay after', formatSofDuration(summary.delaysAfterMs)],
                ['Net operation', formatSofDuration(summary.netOperationMs)],
                [
                  'Average rate',
                  summary.averageRate == null
                    ? 'Pending data'
                    : `${summary.averageRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} / hr`,
                ],
              ].map(([label, value]) => (
                <Box
                  key={label}
                  bg="white"
                  p="sm"
                  style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 4 }}
                >
                  <Text size="xs" c="dimmed">
                    {label}
                  </Text>
                  <Text fw={700} size="sm">
                    {value}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </Paper>
        </Box>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={isSaving}>
            Close
          </Button>
          <Button variant="default" onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
