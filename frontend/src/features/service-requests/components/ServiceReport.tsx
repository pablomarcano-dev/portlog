import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ServiceRequestListResponseSchema } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import type { ServiceRequestListFilters } from '../api';

export function ServiceReport({ filters }: { filters: ServiceRequestListFilters }) {
  const [groupBy, setGroupBy] = useState('national');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['service-requests', 'report', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value != null && value !== '')
          params.set(key, value instanceof Date ? value.toISOString() : String(value));
      });
      return ServiceRequestListResponseSchema.parse(
        await apiRequest(`/service-requests/report?${params}`),
      );
    },
  });
  const rows = data?.items ?? [];
  const totals = new Map<
    string,
    {
      branch: string;
      supplier: string;
      service: string;
      currency: string;
      count: number;
      completed: number;
      cost: number;
      missing: number;
    }
  >();
  for (const row of rows.filter((row) => row.status !== 'CANCELLED')) {
    const key = JSON.stringify([
      groupBy === 'branch' ? row.branchCode : 'National',
      row.supplierId ?? row.supplierName,
      row.type,
      row.serviceLabel,
      row.currency,
    ]);
    const group = totals.get(key) ?? {
      branch: groupBy === 'branch' ? row.branchCode : 'National',
      supplier: row.supplierName ?? 'Unassigned',
      service: row.serviceLabel,
      currency: row.currency,
      count: 0,
      completed: 0,
      cost: 0,
      missing: 0,
    };
    group.count++;
    if (row.status === 'COMPLETED') group.completed++;
    if (row.actualCost == null) group.missing++;
    else group.cost += row.actualCost;
    totals.set(key, group);
  }
  function download() {
    const cell = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const values = [
      [
        'OC',
        'Vessel',
        'Branch',
        'Provider',
        'Service',
        'Status',
        'Scheduled',
        'Actual cost',
        'Currency',
        'Voucher',
        'Supplier invoice',
      ],
      ...rows.map((row) => [
        row.controlNumber,
        row.vesselName,
        row.branchCode,
        row.supplierName,
        row.serviceLabel,
        row.status,
        row.scheduledAt.toISOString(),
        row.actualCost,
        row.currency,
        row.physicalVoucherNo,
        row.supplierInvoiceNo,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + values.map((row) => row.map(cell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={4}>Service consumption</Title>
            <Text size="sm" c="dimmed">
              {filters.branchId ? 'Selected branch' : 'National'} · All records matching the filters
            </Text>
          </div>
          <Button variant="light" disabled={!data || isLoading} onClick={download}>
            Export service register
          </Button>
        </Group>
        {isError && <Alert color="red">Could not load the service report.</Alert>}
        <Select
          label="Group totals"
          value={groupBy}
          onChange={(value) => setGroupBy(value ?? 'national')}
          data={[
            { value: 'national', label: 'National / all selected branches' },
            { value: 'branch', label: 'By branch' },
          ]}
          w={300}
        />
        <SimpleGrid cols={3}>
          {[
            ['Requests', rows.length],
            ['Completed', rows.filter((row) => row.status === 'COMPLETED').length],
            ['Cancelled', rows.filter((row) => row.status === 'CANCELLED').length],
          ].map(([label, value]) => (
            <div key={label}>
              <Text size="xs" c="dimmed">
                {label}
              </Text>
              <Text fw={700} size="xl">
                {isLoading ? '…' : value}
              </Text>
            </div>
          ))}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Costs exclude cancelled requests and are separated by currency. Missing actual costs are
          reported, not treated as confirmed zero costs.
        </Text>
        <Table.ScrollContainer minWidth={700}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                {[
                  'Branch',
                  'Provider',
                  'Service',
                  'Currency',
                  'Requests',
                  'Completed',
                  'Actual cost',
                  'Missing costs',
                ].map((label) => (
                  <Table.Th key={label}>{label}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...totals.entries()].map(([key, group]) => (
                <Table.Tr key={key}>
                  <Table.Td>{group.branch}</Table.Td>
                  <Table.Td>{group.supplier}</Table.Td>
                  <Table.Td>{group.service}</Table.Td>
                  <Table.Td>{group.currency}</Table.Td>
                  <Table.Td>{group.count}</Table.Td>
                  <Table.Td>{group.completed}</Table.Td>
                  <Table.Td>{group.cost.toFixed(2)}</Table.Td>
                  <Table.Td>{group.missing}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Card>
  );
}
