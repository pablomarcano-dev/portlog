import { Badge, Loader, Stack, Table, Text } from '@mantine/core';
import {
  SERVICE_LOCATION_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  type ServiceRequestListItem,
  type ServiceRequestStatus,
} from '@portlog/schemas';
import { formatDateTime } from '../../../lib/format/datetime';

const STATUS_COLORS: Record<ServiceRequestStatus, string> = {
  DRAFT: 'gray',
  SENT: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

interface Props {
  items: ServiceRequestListItem[];
  isLoading: boolean;
  onRowClick: (id: string) => void;
}

export function ServiceRequestTable({ items, isLoading, onRowClick }: Props) {
  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="md">
        No service requests match the current filter.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={1100}>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Control No.</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Vessel</Table.Th>
            <Table.Th>Service</Table.Th>
            <Table.Th>Provider</Table.Th>
            <Table.Th>Location</Table.Th>
            <Table.Th>Scheduled</Table.Th>
            <Table.Th>Voucher</Table.Th>
            <Table.Th ta="right">Cost</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Requested by</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr
              key={item.id}
              onClick={() => onRowClick(item.id)}
              style={{ cursor: 'pointer' }}
            >
              <Table.Td>
                <Text size="sm" fw={600}>
                  {item.controlNumber}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{SERVICE_REQUEST_TYPE_LABELS[item.type].en}</Text>
              </Table.Td>
              <Table.Td>{item.vesselName}</Table.Td>
              <Table.Td>
                <Text size="sm" lineClamp={2}>
                  {item.serviceLabel}
                </Text>
              </Table.Td>
              <Table.Td>{item.supplierName ?? '—'}</Table.Td>
              <Table.Td>{item.location ? SERVICE_LOCATION_LABELS[item.location].en : '—'}</Table.Td>
              <Table.Td>{formatDateTime(item.scheduledAt)}</Table.Td>
              <Table.Td>{item.physicalVoucherNo ?? '—'}</Table.Td>
              <Table.Td ta="right">
                {item.actualCost == null ? '—' : `${item.actualCost.toFixed(2)} ${item.currency}`}
              </Table.Td>
              <Table.Td>
                <Badge color={STATUS_COLORS[item.status]} variant="light">
                  {SERVICE_REQUEST_STATUS_LABELS[item.status].en}
                </Badge>
              </Table.Td>
              <Table.Td>{item.requestedBy}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
