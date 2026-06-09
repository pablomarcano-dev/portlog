import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Button,
  Group,
  TextInput,
  Table,
  Box,
  Text,
  ActionIcon,
} from '@mantine/core';
import { SofBlFiguresDataSchema, SofShipFiguresDataSchema } from '@portlog/schemas';
import type { SofTimesheetResponse } from '@portlog/schemas';
import type { z } from 'zod';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';

const INITIAL_FIGURES_WIDTHS: Record<string, number> = { info: 140, 'col-0': 120 };

type SofBlFiguresData = z.infer<typeof SofBlFiguresDataSchema>;
type SofShipFiguresData = z.infer<typeof SofShipFiguresDataSchema>;

interface SofBillShipFiguresModalProps {
  nominationId: string;
  opened: boolean;
  onClose: () => void;
  sofData: SofTimesheetResponse | undefined;
  onSave: (data: { blFiguresData: SofBlFiguresData; shipFiguresData: SofShipFiguresData }) => void;
  isSaving: boolean;
}

const BL_ROW_KEYS = [
  'grossBbls',
  'netBbls',
  'grossMt',
  'netMt',
  'grossLt',
  'netLt',
  'grossGallons',
  'netGallons',
  'grossCubicM',
  'netCubicM',
  'shipper',
  'consignee',
  'scacCode',
  'originalOnBoard',
  'destination',
  'date',
] as const;

const BL_ROW_LABELS: Record<(typeof BL_ROW_KEYS)[number], string> = {
  grossBbls: 'Gross BBLS',
  netBbls: 'Net BBLS',
  grossMt: 'Gross MT',
  netMt: 'Net M/T',
  grossLt: 'Gross L/T',
  netLt: 'Net L/T',
  grossGallons: 'Gross Gallons',
  netGallons: 'Net Gallons',
  grossCubicM: 'Gross Cubic M.',
  netCubicM: 'Net Cubic M.',
  shipper: 'Shipper',
  consignee: 'Consignee',
  scacCode: 'Scac code',
  originalOnBoard: 'Original on Board',
  destination: 'Destination',
  date: 'Date',
};

const SHIP_ROW_KEYS = ['bbls', 'mtons', 'ltons', 'api', 'temp', 'rob'] as const;

const SHIP_ROW_LABELS: Record<(typeof SHIP_ROW_KEYS)[number], string> = {
  bbls: 'BBLS',
  mtons: 'MTons',
  ltons: 'LTons',
  api: 'API',
  temp: 'Temp',
  rob: 'R.O.B.',
};

type BlRowKey = (typeof BL_ROW_KEYS)[number];
type ShipRowKey = (typeof SHIP_ROW_KEYS)[number];

function makeEmptyBlRows(colCount: number): Record<BlRowKey, string[]> {
  return Object.fromEntries(BL_ROW_KEYS.map((k) => [k, Array(colCount).fill('')])) as Record<
    BlRowKey,
    string[]
  >;
}

function makeEmptyShipRows(colCount: number): Record<ShipRowKey, string[]> {
  return Object.fromEntries(SHIP_ROW_KEYS.map((k) => [k, Array(colCount).fill('')])) as Record<
    ShipRowKey,
    string[]
  >;
}

function parseBlRows(
  raw: Record<string, string[]> | undefined,
  colCount: number,
): Record<BlRowKey, string[]> {
  const base = makeEmptyBlRows(colCount);
  if (!raw) return base;
  for (const key of BL_ROW_KEYS) {
    const vals = raw[key];
    if (Array.isArray(vals)) {
      base[key] = [...vals, ...Array(Math.max(0, colCount - vals.length)).fill('')].slice(
        0,
        colCount,
      );
    }
  }
  return base;
}

function parseShipRows(
  raw: Record<string, string[]> | undefined,
  colCount: number,
): Record<ShipRowKey, string[]> {
  const base = makeEmptyShipRows(colCount);
  if (!raw) return base;
  for (const key of SHIP_ROW_KEYS) {
    const vals = raw[key];
    if (Array.isArray(vals)) {
      base[key] = [...vals, ...Array(Math.max(0, colCount - vals.length)).fill('')].slice(
        0,
        colCount,
      );
    }
  }
  return base;
}

export function SofBillShipFiguresModal({
  nominationId: _nominationId,
  opened,
  onClose,
  sofData,
  onSave,
  isSaving,
}: SofBillShipFiguresModalProps) {
  const [columns, setColumns] = useState<string[]>(['']);
  const [blRows, setBlRows] = useState<Record<BlRowKey, string[]>>(makeEmptyBlRows(1));
  const [shipRows, setShipRows] = useState<Record<ShipRowKey, string[]>>(makeEmptyShipRows(1));
  const {
    colWidths: figuresWidths,
    setColWidths: setFiguresWidths,
    startResize: startFiguresResize,
  } = useColumnResize<string>(INITIAL_FIGURES_WIDTHS);

  useEffect(() => {
    if (!opened) return;
    const blData = sofData?.blFiguresData;
    const shipData = sofData?.shipFiguresData;
    const cols =
      blData?.columns && blData.columns.length > 0
        ? blData.columns
        : shipData?.columns && shipData.columns.length > 0
          ? shipData.columns
          : [''];
    setColumns(cols);
    setBlRows(parseBlRows(blData?.rows, cols.length));
    setShipRows(parseShipRows(shipData?.rows, cols.length));
  }, [opened, sofData]);

  function addColumn() {
    const newColKey = `col-${columns.length}`;
    const newCols = [...columns, ''];
    setColumns(newCols);
    setBlRows(
      (prev) =>
        Object.fromEntries(BL_ROW_KEYS.map((k) => [k, [...prev[k], '']])) as Record<
          BlRowKey,
          string[]
        >,
    );
    setShipRows(
      (prev) =>
        Object.fromEntries(SHIP_ROW_KEYS.map((k) => [k, [...prev[k], '']])) as Record<
          ShipRowKey,
          string[]
        >,
    );
    setFiguresWidths((prev) => ({ ...prev, [newColKey]: 120 }) as Record<string, number>);
  }

  function removeColumn(idx: number) {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
    setBlRows(
      (prev) =>
        Object.fromEntries(
          BL_ROW_KEYS.map((k) => [k, prev[k].filter((_, i) => i !== idx)]),
        ) as Record<BlRowKey, string[]>,
    );
    setShipRows(
      (prev) =>
        Object.fromEntries(
          SHIP_ROW_KEYS.map((k) => [k, prev[k].filter((_, i) => i !== idx)]),
        ) as Record<ShipRowKey, string[]>,
    );
    setFiguresWidths((prev) => {
      const next = { ...prev };
      const colKeys = Object.keys(next)
        .filter((k) => k.startsWith('col-'))
        .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
      colKeys.forEach((k) => delete next[k]);
      const remaining = colKeys.filter((_, i) => i !== idx);
      remaining.forEach((k, i) => {
        next[`col-${i}`] = prev[k]!;
      });
      return next as Record<string, number>;
    });
  }

  function updateColumnHeader(idx: number, value: string) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? value : c)));
  }

  function updateBlCell(rowKey: BlRowKey, colIdx: number, value: string) {
    setBlRows((prev) => ({
      ...prev,
      [rowKey]: prev[rowKey].map((v, i) => (i === colIdx ? value : v)),
    }));
  }

  function updateShipCell(rowKey: ShipRowKey, colIdx: number, value: string) {
    setShipRows((prev) => ({
      ...prev,
      [rowKey]: prev[rowKey].map((v, i) => (i === colIdx ? value : v)),
    }));
  }

  function clearBlRows() {
    setBlRows(makeEmptyBlRows(columns.length));
  }

  function clearShipRows() {
    setShipRows(makeEmptyShipRows(columns.length));
  }

  function handleSave() {
    onSave({
      blFiguresData: { columns, rows: blRows },
      shipFiguresData: { columns, rows: shipRows },
    });
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Bill Figure / Ship Figure"
      size="70vw"
      styles={{ content: { resize: 'both', overflow: 'auto', width: '100%', minWidth: 400 } }}
    >
      <Stack gap="md">
        <Box>
          <Box
            bg="blue.6"
            px="sm"
            py="xs"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text c="white" fw={600} size="sm">
              B/L Figures
            </Text>
            <Group gap="xs">
              <ActionIcon
                size="xs"
                variant="white"
                color="blue"
                title="Add column"
                onClick={addColumn}
              >
                +
              </ActionIcon>
              <Button size="xs" variant="white" color="blue" onClick={clearBlRows}>
                Clear
              </Button>
            </Group>
          </Box>
          <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh
                  width={figuresWidths['info'] ?? 140}
                  onResize={(e) => startFiguresResize('info', e)}
                >
                  Info
                </ResizableTh>
                {columns.map((col, ci) => (
                  <ResizableTh
                    key={ci}
                    width={figuresWidths[`col-${ci}`] ?? 120}
                    onResize={(e) => startFiguresResize(`col-${ci}`, e)}
                  >
                    <Group gap={4} wrap="nowrap">
                      <TextInput
                        size="xs"
                        value={col}
                        onChange={(e) => updateColumnHeader(ci, e.currentTarget.value)}
                        placeholder="Cargo grade"
                        style={{ flex: 1 }}
                      />
                      {columns.length > 1 && (
                        <ActionIcon
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={() => removeColumn(ci)}
                          title="Remove column"
                        >
                          ×
                        </ActionIcon>
                      )}
                    </Group>
                  </ResizableTh>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {BL_ROW_KEYS.map((rowKey) => (
                <Table.Tr key={rowKey}>
                  <Table.Td style={{ width: figuresWidths['info'] ?? 140 }}>
                    <Text size="sm">{BL_ROW_LABELS[rowKey]}</Text>
                  </Table.Td>
                  {columns.map((_, ci) => (
                    <Table.Td key={ci} style={{ width: figuresWidths[`col-${ci}`] ?? 120 }}>
                      <TextInput
                        size="xs"
                        value={blRows[rowKey][ci] ?? ''}
                        onChange={(e) => updateBlCell(rowKey, ci, e.currentTarget.value)}
                      />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        <Box>
          <Box
            bg="blue.6"
            px="sm"
            py="xs"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text c="white" fw={600} size="sm">
              Ship Figures
            </Text>
            <Button size="xs" variant="white" color="blue" onClick={clearShipRows}>
              Clear
            </Button>
          </Box>
          <Table withTableBorder withColumnBorders style={{ tableLayout: 'fixed' }}>
            <Table.Thead>
              <Table.Tr>
                <ResizableTh
                  width={figuresWidths['info'] ?? 140}
                  onResize={(e) => startFiguresResize('info', e)}
                >
                  Info
                </ResizableTh>
                {columns.map((col, ci) => (
                  <ResizableTh
                    key={ci}
                    width={figuresWidths[`col-${ci}`] ?? 120}
                    onResize={(e) => startFiguresResize(`col-${ci}`, e)}
                  >
                    <Text size="sm">{col || <em style={{ color: '#aaa' }}>—</em>}</Text>
                  </ResizableTh>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {SHIP_ROW_KEYS.map((rowKey) => (
                <Table.Tr key={rowKey}>
                  <Table.Td style={{ width: figuresWidths['info'] ?? 140 }}>
                    <Text size="sm">{SHIP_ROW_LABELS[rowKey]}</Text>
                  </Table.Td>
                  {columns.map((_, ci) => (
                    <Table.Td key={ci} style={{ width: figuresWidths[`col-${ci}`] ?? 120 }}>
                      <TextInput
                        size="xs"
                        value={shipRows[rowKey][ci] ?? ''}
                        onChange={(e) => updateShipCell(rowKey, ci, e.currentTarget.value)}
                      />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={isSaving}>
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
