import { useState } from 'react';
import { Button, Card, Group, NumberInput, Stack, TextInput, Textarea, Title } from '@mantine/core';
import type { ServiceRequestRead, ServiceRequestUpdate } from '@portlog/schemas';
export function ServiceReconciliation({
  request,
  saving,
  onSave,
}: {
  request: ServiceRequestRead;
  saving: boolean;
  onSave: (values: ServiceRequestUpdate) => void;
}) {
  const [cost, setCost] = useState<number | string>(request.actualCost ?? '');
  const [invoice, setInvoice] = useState(request.supplierInvoiceNo ?? '');
  const [voucher, setVoucher] = useState(request.physicalVoucherNo ?? '');
  const [notes, setNotes] = useState(request.reconciliationNotes ?? '');
  return (
    <Card withBorder>
      <Stack>
        <Title order={4}>Invoice and service reconciliation</Title>
        <Group grow>
          <TextInput
            label="Supplier invoice number"
            value={invoice}
            onChange={(event) => setInvoice(event.currentTarget.value)}
          />
          <TextInput
            label="Physical voucher"
            value={voucher}
            onChange={(event) => setVoucher(event.currentTarget.value)}
          />
          <NumberInput
            label={`Actual cost (${request.currency})`}
            min={0}
            decimalScale={2}
            value={cost}
            onChange={setCost}
          />
        </Group>
        <Textarea
          label="Internal reconciliation notes"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
        <Button
          loading={saving}
          disabled={request.status === 'CANCELLED'}
          onClick={() =>
            onSave({
              supplierInvoiceNo: invoice,
              physicalVoucherNo: voucher,
              actualCost: typeof cost === 'number' ? cost : null,
              reconciliationNotes: notes,
            })
          }
        >
          Save reconciliation
        </Button>
      </Stack>
    </Card>
  );
}
