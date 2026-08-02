import { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  TextInput,
  NumberInput,
  Select,
  Divider,
  Table,
  ActionIcon,
} from '@mantine/core';
import { DateInput, DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NominationParcelRead } from '@portlog/schemas';
import { nominationsApi } from '../api';
import { useNominationCompose } from '../api/useNominationCompose';
import { useColumnResize } from '../../../components/table/useColumnResize';
import { ResizableTh } from '../../../components/table/ResizableTh';
import { unitSelectData } from '../parcelUnits';
import { formatEtc, parseEtc, toEtcParts } from '../parcelEtc';
import { EmailComposeDrawer } from './EmailComposeDrawer';
import { CargoNamePicker } from './CargoNamePicker';

const OPERATION_OPTIONS = [
  { value: 'Load', label: 'Load' },
  { value: 'Disch', label: 'Disch' },
  { value: 'Transit', label: 'Transit' },
  { value: 'STSD', label: 'STSD' },
  { value: 'STSL', label: 'STSL' },
  { value: 'Bunker', label: 'Bunker' },
];

// ---------------------------------------------------------------------------
// Column definitions — keys drive both header labels and width state
// ---------------------------------------------------------------------------

type ColKey =
  | 'idx'
  | 'product'
  | 'quantity'
  | 'unit'
  | 'etcDate'
  | 'operation'
  | 'qtyOnBoard'
  | 'qtyOnBoardUnit'
  | 'qtyToGo'
  | 'qtyToGoUnit'
  | 'loadingRate'
  | 'loadingRateUnit'
  | 'actions';

const INITIAL_WIDTHS: Record<ColKey, number> = {
  idx: 32,
  product: 150,
  quantity: 100,
  unit: 70,
  etcDate: 165,
  operation: 100,
  qtyOnBoard: 90,
  qtyOnBoardUnit: 70,
  qtyToGo: 90,
  qtyToGoUnit: 70,
  loadingRate: 90,
  loadingRateUnit: 70,
  actions: 36,
};

const COL_LABELS: Record<ColKey, string> = {
  idx: '#',
  product: 'Product',
  quantity: 'Qty Nominated',
  unit: 'Unit',
  etcDate: 'ETC Date',
  operation: 'Operation',
  qtyOnBoard: 'Qty On Board',
  qtyOnBoardUnit: 'Unit',
  qtyToGo: 'Qty To Go',
  qtyToGoUnit: 'Unit',
  loadingRate: 'Loading Rate',
  loadingRateUnit: 'Unit',
  actions: '',
};

const COL_KEYS = Object.keys(INITIAL_WIDTHS) as ColKey[];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CargoUpdateModalProps {
  opened: boolean;
  onClose: () => void;
  nominationId: string;
  pedrId: string;
  initialParcels: NominationParcelRead[];
}

interface ParcelRow extends NominationParcelRead {
  _key: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Mantine number inputs hand back `''` or a raw string mid-edit; the DB gets a number. */
function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CargoUpdateModal({
  opened,
  onClose,
  nominationId,
  pedrId,
  initialParcels,
}: CargoUpdateModalProps) {
  const qc = useQueryClient();
  const now = new Date();

  const [rows, setRows] = useState<ParcelRow[]>(() =>
    initialParcels.map((p, i) => ({ ...p, _key: String(i) })),
  );
  const [dateUpdate, setDateUpdate] = useState<Date | null>(now);
  const [timeUpdate, setTimeUpdate] = useState(fmtTime(now));
  const [dateEtd, setDateEtd] = useState<Date | null>(null);
  const [timeEtd, setTimeEtd] = useState('');

  // Compose drawer (the "edit email" screen) — opened after parcels are saved
  // and the email body is built, so the user can review/edit before sending.
  const [composeOpen, setComposeOpen] = useState(false);
  const [emailBody, setEmailBody] = useState('');

  const { colWidths, startResize } = useColumnResize<ColKey>(INITIAL_WIDTHS);

  const { data: composeData } = useNominationCompose(nominationId, 'CARGO_UPDATE');

  // -------------------------------------------------------------------------
  // Row mutations
  // -------------------------------------------------------------------------

  const saveMutation = useMutation({
    // `_key` is a render key only — the parcels column is raw JSON, so anything
    // sent here is what the next reader gets back.
    mutationFn: () =>
      nominationsApi.updateParcels(
        nominationId,
        rows.map(({ _key: _drop, ...parcel }) => parcel),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nominations', nominationId] });
      notifications.show({
        title: 'Saved',
        message: 'Parcels saved successfully.',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to save parcels.', color: 'red' });
    },
  });

  function patchRow(key: string, patch: Partial<ParcelRow>) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function updateRow(key: string, field: keyof ParcelRow, value: unknown) {
    patchRow(key, { [field]: value } as Partial<ParcelRow>);
  }

  /**
   * Nominated and on-board quantities drive Qty To Go: what is still to be
   * moved is what the terminal nominated minus what is already aboard. The
   * result stays editable — an operator can override it after a manual gauge —
   * but touching either input recomputes it.
   */
  function updateQuantity(key: string, field: 'quantity' | 'qtyOnBoard', value: unknown) {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        const next = { ...r, [field]: toNumber(value) };
        return {
          ...next,
          qtyToGo: Math.max(0, toNumber(next.quantity) - toNumber(next.qtyOnBoard)),
        };
      }),
    );
  }

  /**
   * A catalog product carries its own unit, so picking one fills every unit
   * cell on the row instead of making the operator retype it four times.
   */
  function applyProductUnit(key: string, bblUnit: string) {
    const unit = bblUnit.trim();
    if (!unit) return;
    patchRow(key, {
      unit,
      qtyOnBoardUnit: unit,
      qtyToGoUnit: unit,
      loadingRateUnit: unit,
    });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        _key: String(Date.now()),
        product: '',
        quantity: 0,
        // Units are left blank on purpose — picking the product fills them in.
        unit: '',
        operation: 'Load',
        qtyOnBoard: 0,
        qtyOnBoardUnit: '',
        qtyToGo: 0,
        qtyToGoUnit: '',
        loadingRate: 0,
        loadingRateUnit: '',
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
  }

  async function handleSend() {
    await saveMutation.mutateAsync();

    if (!composeData) {
      notifications.show({ title: 'Error', message: 'Compose data not ready.', color: 'red' });
      return;
    }

    const updateDateStr = dateUpdate ? fmtDate(dateUpdate) : '';
    const etdStr = dateEtd ? fmtDate(dateEtd) : '';

    const parcelLines = rows
      .map(
        (p) =>
          `------------------------------------------------------\n` +
          `${updateDateStr} ${timeUpdate} Cargo Update - ${p.product}\n` +
          `------------------------------------------------------\n` +
          // `||`, not `??` — a unit cell left on its inherited default is stored
          // as an empty string, which `??` would happily print as no unit at all.
          `Quantity         : ${p.quantity ?? 0} ${p.unit ?? ''}\n` +
          `Quantity On Board: ${p.qtyOnBoard ?? 0} ${p.qtyOnBoardUnit || p.unit || ''}\n` +
          `Quantity To Go   : ${p.qtyToGo ?? 0} ${p.qtyToGoUnit || p.unit || ''}\n` +
          `Loading Rate     : ${p.loadingRate ?? 0} ${p.loadingRateUnit || p.unit || ''}\n` +
          `------------------------------------------------------\n\n` +
          `${formatEtc(p.etcDate, p.etcTime)} ETC`,
      )
      .join('\n\n');

    // Keep the template's header (everything before its first rule) and append
    // the parcel blocks built from the figures entered above.
    const bodyText =
      composeData.bodyText.split('------')[0] +
      parcelLines +
      `\n\n${etdStr} ${timeEtd} ETD (Subject to Port Security Inspection / Weather Conditions)`;

    // Hand the built body to the compose drawer so the user can review and edit
    // recipients/subject/body before the email is actually sent. Plain text —
    // the drawer wraps it for display when sending.
    setEmailBody(bodyText);
    setComposeOpen(true);
  }

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------

  return (
    <>
      <Modal
        opened={opened && !composeOpen}
        onClose={onClose}
        title={
          <Text fw={600} size="sm">
            Cargo Update
          </Text>
        }
        padding="lg"
        size="70vw"
        styles={{
          content: {
            resize: 'both',
            overflow: 'auto',
            width: '100%',
            minWidth: 400,
            minHeight: 300,
          },
        }}
      >
        <Stack gap="sm">
          {/* Date / ETD — at top, matching other modal patterns */}
          <Group gap="xl">
            <Group gap="xs" align="flex-end">
              <DateInput
                label="Date Update"
                size="sm"
                value={dateUpdate}
                onChange={setDateUpdate}
                style={{ width: 150 }}
              />
              <TextInput
                label="Time"
                size="sm"
                placeholder="HH:MM"
                value={timeUpdate}
                onChange={(e) => setTimeUpdate(e.currentTarget.value)}
                style={{ width: 80 }}
              />
            </Group>
            <Group gap="xs" align="flex-end">
              <DateInput
                label="Date ETD"
                size="sm"
                value={dateEtd}
                onChange={setDateEtd}
                style={{ width: 150 }}
              />
              <TextInput
                label="Time"
                size="sm"
                placeholder="HH:MM"
                value={timeEtd}
                onChange={(e) => setTimeEtd(e.currentTarget.value)}
                style={{ width: 80 }}
              />
            </Group>
          </Group>

          <Divider />

          {/* Parcel table */}
          <div style={{ overflowX: 'auto' }}>
            <Table
              withTableBorder
              withColumnBorders
              fz="xs"
              style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
            >
              <Table.Thead>
                <Table.Tr>
                  {COL_KEYS.map((col) => (
                    <ResizableTh
                      key={col}
                      width={colWidths[col]}
                      onResize={(e) => startResize(col, e)}
                    >
                      {COL_LABELS[col]}
                    </ResizableTh>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={COL_KEYS.length}>
                      <Text size="xs" c="dimmed" ta="center">
                        No parcels — add a row below.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {rows.map((row, i) => (
                  <Table.Tr key={row._key}>
                    <Table.Td style={{ width: colWidths.idx }}>{i + 1}</Table.Td>
                    <Table.Td style={{ width: colWidths.product }}>
                      <CargoNamePicker
                        size="xs"
                        value={row.product}
                        onChange={(v) => updateRow(row._key, 'product', v)}
                        onCargoSelect={(cargo) => applyProductUnit(row._key, cargo.bblUnit)}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.quantity }}>
                      <NumberInput
                        size="xs"
                        min={0}
                        value={row.quantity ?? 0}
                        onChange={(v) => updateQuantity(row._key, 'quantity', v)}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.unit }}>
                      <Select
                        size="xs"
                        placeholder="Unit"
                        data={unitSelectData(row.unit)}
                        value={row.unit || null}
                        onChange={(v) => updateRow(row._key, 'unit', v ?? '')}
                        comboboxProps={{ withinPortal: true }}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.etcDate }}>
                      <DateTimePicker
                        size="xs"
                        valueFormat="DD/MM/YYYY HH:mm"
                        placeholder="Select date/time"
                        clearable
                        styles={{ input: { fontSize: 12 } }}
                        value={parseEtc(row.etcDate, row.etcTime)}
                        onChange={(d) => patchRow(row._key, toEtcParts(d))}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.operation }}>
                      <Select
                        size="xs"
                        data={OPERATION_OPTIONS}
                        value={row.operation ?? null}
                        onChange={(v) => updateRow(row._key, 'operation', v ?? '')}
                        comboboxProps={{ withinPortal: true }}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.qtyOnBoard }}>
                      <NumberInput
                        size="xs"
                        min={0}
                        value={row.qtyOnBoard ?? 0}
                        onChange={(v) => updateQuantity(row._key, 'qtyOnBoard', v)}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.qtyOnBoardUnit }}>
                      <Select
                        size="xs"
                        placeholder="Unit"
                        data={unitSelectData(row.qtyOnBoardUnit, row.unit)}
                        value={row.qtyOnBoardUnit || row.unit || null}
                        onChange={(v) => updateRow(row._key, 'qtyOnBoardUnit', v ?? '')}
                        comboboxProps={{ withinPortal: true }}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.qtyToGo }}>
                      <NumberInput
                        size="xs"
                        min={0}
                        value={row.qtyToGo ?? 0}
                        onChange={(v) => updateRow(row._key, 'qtyToGo', toNumber(v))}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.qtyToGoUnit }}>
                      <Select
                        size="xs"
                        placeholder="Unit"
                        data={unitSelectData(row.qtyToGoUnit, row.unit)}
                        value={row.qtyToGoUnit || row.unit || null}
                        onChange={(v) => updateRow(row._key, 'qtyToGoUnit', v ?? '')}
                        comboboxProps={{ withinPortal: true }}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.loadingRate }}>
                      <NumberInput
                        size="xs"
                        min={0}
                        value={row.loadingRate ?? 0}
                        onChange={(v) => updateRow(row._key, 'loadingRate', toNumber(v))}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.loadingRateUnit }}>
                      <Select
                        size="xs"
                        placeholder="Unit"
                        data={unitSelectData(row.loadingRateUnit, row.unit)}
                        value={row.loadingRateUnit || row.unit || null}
                        onChange={(v) => updateRow(row._key, 'loadingRateUnit', v ?? '')}
                        comboboxProps={{ withinPortal: true }}
                      />
                    </Table.Td>
                    <Table.Td style={{ width: colWidths.actions }}>
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant="subtle"
                        onClick={() => removeRow(row._key)}
                        aria-label="Remove row"
                      >
                        ×
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>

          <Button size="xs" variant="subtle" onClick={addRow} style={{ alignSelf: 'flex-start' }}>
            + Add row
          </Button>

          {/* Actions */}
          <Group justify="space-between" mt="sm">
            <Button
              variant="light"
              size="sm"
              loading={saveMutation.isPending}
              onClick={() => void handleSend()}
            >
              Send Message
            </Button>
            <Group gap="xs">
              <Button variant="default" onClick={onClose} disabled={saveMutation.isPending}>
                Close
              </Button>
              <Button
                variant="default"
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save as Draft
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Edit-email screen — review recipients/subject/body before sending */}
      <EmailComposeDrawer
        opened={composeOpen}
        onClose={() => setComposeOpen(false)}
        pedrId={pedrId}
        nominationId={nominationId}
        subDocType="CARGO_UPDATE"
        defaultSubject={composeData?.subject ?? ''}
        defaultBody={emailBody}
      />
    </>
  );
}
