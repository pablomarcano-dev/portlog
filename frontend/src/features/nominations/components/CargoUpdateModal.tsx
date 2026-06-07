import { useCallback, useState } from 'react';
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
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NominationParcelRead } from '@portlog/schemas';
import { nominationsApi } from '../api';
import { useNominationSendEmail } from '../api/useNominationSendEmail';
import { useNominationCompose } from '../api/useNominationCompose';

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
  etcDate: 110,
  operation: 100,
  qtyOnBoard: 90,
  qtyOnBoardUnit: 60,
  qtyToGo: 90,
  qtyToGoUnit: 60,
  loadingRate: 90,
  loadingRateUnit: 60,
  actions: 36,
};

const COL_LABELS: Record<ColKey, string> = {
  idx: '#',
  product: 'Product',
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CargoUpdateModalProps {
  opened: boolean;
  onClose: () => void;
  nominationId: string;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CargoUpdateModal({
  opened,
  onClose,
  nominationId,
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

  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(INITIAL_WIDTHS);

  const { data: composeData } = useNominationCompose(nominationId, 'CARGO_UPDATE');

  // -------------------------------------------------------------------------
  // Column resize — attaches to document during drag so it works outside the th
  // -------------------------------------------------------------------------

  const startColResize = useCallback(
    (col: ColKey, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = colWidths[col];

      function onMove(ev: MouseEvent) {
        const next = Math.max(40, startWidth + ev.clientX - startX);
        setColWidths((prev) => ({ ...prev, [col]: next }));
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [colWidths],
  );

  // -------------------------------------------------------------------------
  // Row mutations
  // -------------------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: () => nominationsApi.updateParcels(nominationId, rows),
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

  const sendEmail = useNominationSendEmail(nominationId);

  function updateRow(key: string, field: keyof ParcelRow, value: unknown) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        _key: String(Date.now()),
        product: '',
        quantity: 0,
        unit: 'MT',
        operation: 'Load',
        qtyOnBoard: 0,
        qtyOnBoardUnit: 'MT',
        qtyToGo: 0,
        qtyToGoUnit: 'MT',
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
          `Quantity On Board: ${p.qtyOnBoard ?? 0} ${p.qtyOnBoardUnit ?? p.unit ?? ''}\n` +
          `Quantity To Go   : ${p.qtyToGo ?? 0} ${p.qtyToGoUnit ?? p.unit ?? ''}\n` +
          `Loading Rate     : ${p.loadingRate ?? 0} ${p.loadingRateUnit ?? ''}\n` +
          `------------------------------------------------------\n\n` +
          `${p.etcDate ?? ''} ETC`,
      )
      .join('\n\n');

    const bodyText =
      composeData.bodyHtml.replace(/<pre[^>]*>|<\/pre>/gi, '').split('------')[0] +
      parcelLines +
      `\n\n${etdStr} ${timeEtd} ETD (Subject to Port Security Inspection / Weather Conditions)`;

    const bodyHtml = `<pre style="font-family:'Courier New',Consolas,monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;padding:16px;margin:0;">${bodyText}</pre>`;

    sendEmail.mutate({
      subDocType: 'CARGO_UPDATE',
      toAddresses: composeData.toAddresses,
      ccAddresses: composeData.ccAddresses,
      bccAddresses: composeData.bccAddresses,
      subject: composeData.subject,
      bodyHtml,
    });
  }

  // -------------------------------------------------------------------------
  // Render helper — resizable <th>
  // -------------------------------------------------------------------------

  function ResizableTh({ col, children }: { col: ColKey; children?: React.ReactNode }) {
    return (
      <Table.Th
        style={{
          width: colWidths[col],
          minWidth: colWidths[col],
          position: 'relative',
          userSelect: 'none',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
        {/* drag handle — sits on the right edge of the header cell */}
        <div
          onMouseDown={(e) => startColResize(col, e)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 5,
            cursor: 'col-resize',
            zIndex: 1,
          }}
        />
      </Table.Th>
    );
  }

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="sm">
          Cargo Update
        </Text>
      }
      size="xl"
      padding="lg"
      styles={{
        content: {
          resize: 'both',
          overflow: 'auto',
          minWidth: 600,
          minHeight: 300,
        },
      }}
    >
      <Stack gap="sm">
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
                {(Object.keys(INITIAL_WIDTHS) as ColKey[]).map((col) => (
                  <ResizableTh key={col} col={col}>
                    {COL_LABELS[col]}
                  </ResizableTh>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={11}>
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
                    <TextInput
                      size="xs"
                      value={row.product}
                      onChange={(e) => updateRow(row._key, 'product', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.etcDate }}>
                    <TextInput
                      size="xs"
                      placeholder="MM/DD/YYYY"
                      value={row.etcDate ?? ''}
                      onChange={(e) => updateRow(row._key, 'etcDate', e.currentTarget.value)}
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
                      onChange={(v) => updateRow(row._key, 'qtyOnBoard', v)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.qtyOnBoardUnit }}>
                    <TextInput
                      size="xs"
                      value={row.qtyOnBoardUnit ?? row.unit ?? ''}
                      onChange={(e) => updateRow(row._key, 'qtyOnBoardUnit', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.qtyToGo }}>
                    <NumberInput
                      size="xs"
                      min={0}
                      value={row.qtyToGo ?? 0}
                      onChange={(v) => updateRow(row._key, 'qtyToGo', v)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.qtyToGoUnit }}>
                    <TextInput
                      size="xs"
                      value={row.qtyToGoUnit ?? row.unit ?? ''}
                      onChange={(e) => updateRow(row._key, 'qtyToGoUnit', e.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.loadingRate }}>
                    <NumberInput
                      size="xs"
                      min={0}
                      value={row.loadingRate ?? 0}
                      onChange={(v) => updateRow(row._key, 'loadingRate', v)}
                    />
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.loadingRateUnit }}>
                    <TextInput
                      size="xs"
                      value={row.loadingRateUnit ?? ''}
                      onChange={(e) =>
                        updateRow(row._key, 'loadingRateUnit', e.currentTarget.value)
                      }
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

        <Divider />

        {/* Date / ETD */}
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

        {/* Actions */}
        <Group justify="space-between">
          <Button
            variant="light"
            size="sm"
            loading={sendEmail.isPending}
            onClick={() => void handleSend()}
          >
            Send Message
          </Button>
          <Group gap="xs">
            <Button variant="default" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="default"
              size="sm"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
