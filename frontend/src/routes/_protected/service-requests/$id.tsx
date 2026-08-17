import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ServiceRequestStatus } from '@portlog/schemas';
import { ServiceRequestStepper } from '../../../features/service-requests/components/ServiceRequestStepper';
import { SendOrderDrawer } from '../../../features/service-requests/components/SendOrderDrawer';
import {
  useServiceRequest,
  useServiceRequestDispatches,
  useTransitionServiceRequest,
  useUpdateServiceRequest,
} from '../../../features/service-requests/hooks';
import { formatDateTime } from '../../../lib/format/datetime';

export const Route = createFileRoute('/_protected/service-requests/$id')({
  component: ServiceRequestDetailPage,
});

const STATUS_COLORS: Record<ServiceRequestStatus, string> = {
  DRAFT: 'gray',
  SENT: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

function ServiceRequestDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [sendOpen, setSendOpen] = useState(false);

  const { data: request, isLoading, isError } = useServiceRequest(id);
  const { data: dispatches } = useServiceRequestDispatches(id);
  const update = useUpdateServiceRequest(id);
  const transition = useTransitionServiceRequest(id);

  if (isLoading) {
    return (
      <Stack p="xl" align="center">
        <Loader />
      </Stack>
    );
  }

  if (isError || !request) {
    return (
      <Stack p="xl">
        <Alert color="red" title="Service request not found">
          It may have been deleted.
        </Alert>
      </Stack>
    );
  }

  const apiBase = import.meta.env.VITE_API_URL as string;

  return (
    <Stack p="xl" gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm" align="center">
            <Title order={2}>{request.controlNumber}</Title>
            <Badge color={STATUS_COLORS[request.status]} variant="light">
              {request.status}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {request.shipParticular.name}
            {request.shipParticular.imoNumber
              ? ` — IMO ${request.shipParticular.imoNumber}`
              : ''} · {request.branch.name}
          </Text>
        </div>

        <Group>
          {request.minioKey && (
            <Anchor
              href={`${apiBase}/service-requests/${id}/order.pdf`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="default">View purchase order</Button>
            </Anchor>
          )}
          <Button onClick={() => setSendOpen(true)} disabled={request.status === 'CANCELLED'}>
            Generate &amp; Send Order
          </Button>
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="default">Actions</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                disabled={request.status !== 'SENT' || transition.isPending}
                onClick={() =>
                  transition.mutate(
                    { status: 'COMPLETED' },
                    {
                      onSuccess: () =>
                        notifications.show({
                          color: 'green',
                          title: 'Request completed',
                          message: request.controlNumber,
                        }),
                    },
                  )
                }
              >
                Mark as completed
              </Menu.Item>
              <Menu.Item
                color="red"
                disabled={request.status === 'CANCELLED' || transition.isPending}
                onClick={() =>
                  transition.mutate(
                    { status: 'CANCELLED' },
                    {
                      onSuccess: () =>
                        notifications.show({
                          color: 'orange',
                          title: 'Request cancelled',
                          message: request.controlNumber,
                        }),
                    },
                  )
                }
              >
                Cancel request
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {request.status === 'CANCELLED' && request.cancelReason && (
        <Alert color="red" variant="light" title="Request cancelled">
          {request.cancelReason}
        </Alert>
      )}

      {request.status !== 'DRAFT' && (
        <Alert color="gray" variant="light">
          The order has already been issued. Only the voucher number, actual cost, completion date
          and observations can still be changed.
        </Alert>
      )}

      <ServiceRequestStepper
        request={request}
        type={request.type}
        defaultBranchId={request.branchId}
        isSaving={update.isPending}
        onCancel={() =>
          void navigate({ to: '/service-requests', search: { page: 1, pageSize: 25 } })
        }
        onSubmit={(values) =>
          update.mutate(values, {
            onSuccess: () =>
              notifications.show({
                color: 'green',
                title: 'Changes saved',
                message: request.controlNumber,
              }),
            onError: (err) =>
              notifications.show({
                color: 'red',
                title: 'Could not save the changes',
                message: err instanceof Error ? err.message : 'Please try again',
              }),
          })
        }
      />

      {dispatches && dispatches.length > 0 && (
        <Card withBorder padding="md">
          <Title order={5} mb="sm">
            Dispatch history
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>To</Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th>Sent by</Table.Th>
                <Table.Th>Result</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {dispatches.map((dispatch) => (
                <Table.Tr key={dispatch.id}>
                  <Table.Td>{formatDateTime(dispatch.createdAt)}</Table.Td>
                  <Table.Td>{dispatch.toAddresses.join(', ')}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {dispatch.subject}
                    </Text>
                  </Table.Td>
                  <Table.Td>{dispatch.sentBy.email}</Table.Td>
                  <Table.Td>
                    {dispatch.sentAt ? (
                      <Badge color="green" variant="light">
                        Sent
                      </Badge>
                    ) : (
                      <Badge color="red" variant="light" title={dispatch.error ?? undefined}>
                        Failed
                      </Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <SendOrderDrawer opened={sendOpen} onClose={() => setSendOpen(false)} request={request} />
    </Stack>
  );
}
