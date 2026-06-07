import { useState } from 'react';
import {
  Modal,
  Table,
  TextInput,
  NumberInput,
  Select,
  Button,
  Group,
  Text,
  ActionIcon,
  Stack,
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

interface CargoUpdateModalProps {
  opened: boolean;
  onClose: () => void;
  nominationId: string;
  initialParcels: NominationParcelRead[];
}

interface ParcelRow extends NominationParcelRead {
  _key: string;
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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

  const { data: composeData } = useNominationCompose(nominationId, 'CARGO_UPDATE');

  const saveMutation = useMutation({
    mutationFn: () => nominationsApi.updateParcels(nominationId, rows),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nominations', nominationId] });
      notifications.show({ title: 'Saved', message: 'Parcels saved.', color: 'green' });
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
      composeData.bodyHtml
        .replace(/<pre[^>]*>|<\/pre>/gi, '')
        .split('------------------------------------------------------')[0] +
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Cargo Update"
      size="90%"
      styles={{ header: { background: '#4a90d9', color: 'white' }, title: { fontWeight: 700 } }}
    >
      <Stack gap="md">
        {/* Parcel table */}
        <Table withTableBorder withColumnBorders fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={30}>#</Table.Th>
              <Table.Th>Product</Table.Th>
              <Table.Th>ETC Date</Table.Th>
              <Table.Th>Operation</Table.Th>
              <Table.Th>Qty On Board</Table.Th>
              <Table.Th w={70}>Unit</Table.Th>
              <Table.Th>Qty To Go</Table.Th>
              <Table.Th w={70}>Unit</Table.Th>
              <Table.Th>Loading Rate</Table.Th>
              <Table.Th w={70}>Unit</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={11}>
                  <Text size="xs" c="dimmed" ta="center">
                    No parcels
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {rows.map((row, i) => (
              <Table.Tr key={row._key}>
                <Table.Td>{i + 1}</Table.Td>
                <Table.Td>
                  <TextInput
                    size="xs"
                    value={row.product}
                    onChange={(e) => updateRow(row._key, 'product', e.currentTarget.value)}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    size="xs"
                    placeholder="MM/DD/YYYY"
                    value={row.etcDate ?? ''}
                    onChange={(e) => updateRow(row._key, 'etcDate', e.currentTarget.value)}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={OPERATION_OPTIONS}
                    value={row.operation ?? null}
                    onChange={(v) => updateRow(row._key, 'operation', v ?? '')}
                    comboboxProps={{ withinPortal: true }}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    value={row.qtyOnBoard ?? 0}
                    onChange={(v) => updateRow(row._key, 'qtyOnBoard', v)}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    size="xs"
                    value={row.qtyOnBoardUnit ?? row.unit ?? ''}
                    onChange={(e) => updateRow(row._key, 'qtyOnBoardUnit', e.currentTarget.value)}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    value={row.qtyToGo ?? 0}
                    onChange={(v) => updateRow(row._key, 'qtyToGo', v)}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    size="xs"
                    value={row.qtyToGoUnit ?? row.unit ?? ''}
                    onChange={(e) => updateRow(row._key, 'qtyToGoUnit', e.currentTarget.value)}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    value={row.loadingRate ?? 0}
                    onChange={(v) => updateRow(row._key, 'loadingRate', v)}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    size="xs"
                    value={row.loadingRateUnit ?? ''}
                    onChange={(e) => updateRow(row._key, 'loadingRateUnit', e.currentTarget.value)}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    size="xs"
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

        <Button size="xs" variant="outline" onClick={addRow} style={{ alignSelf: 'flex-start' }}>
          + Add row
        </Button>

        {/* Date/ETD fields */}
        <Group gap="xl">
          <Group gap="xs" align="flex-end">
            <DateInput
              label="Date Update"
              size="xs"
              value={dateUpdate}
              onChange={setDateUpdate}
              style={{ width: 150 }}
            />
            <TextInput
              label="Time"
              size="xs"
              placeholder="HH:MM"
              value={timeUpdate}
              onChange={(e) => setTimeUpdate(e.currentTarget.value)}
              style={{ width: 80 }}
            />
          </Group>
          <Group gap="xs" align="flex-end">
            <DateInput
              label="Date ETD"
              size="xs"
              value={dateEtd}
              onChange={setDateEtd}
              style={{ width: 150 }}
            />
            <TextInput
              label="Time"
              size="xs"
              placeholder="HH:MM"
              value={timeEtd}
              onChange={(e) => setTimeEtd(e.currentTarget.value)}
              style={{ width: 80 }}
            />
          </Group>
        </Group>

        {/* Actions */}
        <Group justify="flex-end" gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<span>💾</span>}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save
          </Button>
          <Button
            size="xs"
            variant="filled"
            color="blue"
            leftSection={<span>✉</span>}
            loading={sendEmail.isPending}
            onClick={() => void handleSend()}
          >
            Send Message
          </Button>
          <Button size="xs" variant="subtle" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
