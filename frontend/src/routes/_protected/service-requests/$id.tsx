import { ServiceReconciliation } from '../../../features/service-requests/components/ServiceReconciliation';
import { ServiceOrderReceipt } from '../../../features/service-requests/components/ServiceOrderReceipt';
import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Alert,
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
import { z } from 'zod';
import { ServiceRequestSendReadinessSchema, type ServiceRequestStatus } from '@portlog/schemas';
import { ServiceRequestStepper } from '../../../features/service-requests/components/ServiceRequestStepper';
import { SendOrderDrawer } from '../../../features/service-requests/components/SendOrderDrawer';
import {
  downloadServiceRequestDispatchOrder,
  downloadServiceRequestOrder,
} from '../../../features/service-requests/api';
import {
  useServiceRequest,
  useApproveServiceRequest,
  useServiceRequestDispatches,
  useTransitionServiceRequest,
  useUpdateServiceRequest,
} from '../../../features/service-requests/hooks';
import { formatDateTime } from '../../../lib/format/datetime';
import { useCurrentUser } from '../../../lib/auth/queries';

export const Route = createFileRoute('/_protected/service-requests/$id')({
  validateSearch: z.object({
    step: z.enum(['documents']).optional(),
  }),
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
  const { step } = Route.useSearch();
  const navigate = useNavigate();
  const [sendOpen, setSendOpen] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [dispatchDownloading, setDispatchDownloading] = useState<string | null>(null);

  const { data: request, isLoading, isError } = useServiceRequest(id);
  const { data: dispatches } = useServiceRequestDispatches(id);
  const update = useUpdateServiceRequest(id);
  const approve = useApproveServiceRequest(id);
  const { data: currentUser } = useCurrentUser({ refetchOnMount: 'always' });
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

  async function downloadOrder(format: 'pdf' | 'docx') {
    setDownloading(format);
    try {
      const blob = await downloadServiceRequestOrder(id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OC-${request!.controlNumber.replaceAll('/', '-')}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not download the purchase order',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setDownloading(null);
    }
  }

  async function downloadDispatch(dispatchId: string, format: 'pdf' | 'docx') {
    setDispatchDownloading(`${dispatchId}-${format}`);
    try {
      const blob = await downloadServiceRequestDispatchOrder(id, dispatchId, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OC-${request!.controlNumber.replaceAll('/', '-')}-${dispatchId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Could not download this dispatch',
      });
    } finally {
      setDispatchDownloading(null);
    }
  }
  const sendReadiness = ServiceRequestSendReadinessSchema.safeParse({
    supplierId: request.supplierId,
    details: request.details,
    documentCount: request.documents.length,
    requestedByAuthority: request.requestedByAuthority,
    requestingAuthority: request.requestingAuthority,
  });
  const sendBlockers = sendReadiness.success
    ? []
    : sendReadiness.error.issues.map((issue) => issue.message);
  const sendDisabled = request.status === 'CANCELLED' || sendBlockers.length > 0;
  const isResend = request.sentAt !== null;
  const canApprove =
    currentUser?.role === 'ADM' ||
    (currentUser?.operationalRole === 'BRANCH_MANAGER' &&
      currentUser.branchId === request.branchId);

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
            {request.shipParticular?.name ?? 'Administration'}
            {request.shipParticular?.imoNumber
              ? ` — IMO ${request.shipParticular.imoNumber}`
              : ''}{' '}
            · {request.branch.name}
          </Text>
          <Text size="sm" c="dimmed">
            Requested by {request.createdBy.displayName?.trim() || request.createdBy.email} on{' '}
            {formatDateTime(request.createdAt)}
          </Text>
        </div>

        <Group>
          <Button
            variant="default"
            loading={downloading === 'docx'}
            disabled={request.status !== 'DRAFT' && !request.issuedDocxKey}
            onClick={() => void downloadOrder('docx')}
          >
            Download Word order
          </Button>
          {request.minioKey && (
            <Button
              variant="default"
              loading={downloading === 'pdf'}
              onClick={() => void downloadOrder('pdf')}
            >
              Download purchase order PDF
            </Button>
          )}
          <Stack gap={2} align="flex-end">
            <Button onClick={() => setSendOpen(true)} disabled={sendDisabled}>
              {request.status === 'CANCELLED'
                ? 'Request cancelled'
                : sendBlockers.length > 0
                  ? `${sendBlockers.length} requirement${sendBlockers.length === 1 ? '' : 's'} missing`
                  : isResend
                    ? 'Generate & Resend Order'
                    : 'Generate & Send Order'}
            </Button>
            <Text
              size="xs"
              c={sendDisabled ? 'red' : 'teal'}
              ta="right"
              maw={320}
              aria-live="polite"
            >
              {request.status === 'CANCELLED'
                ? 'Cancelled requests cannot be sent.'
                : sendBlockers.length > 0
                  ? sendBlockers.join(' · ')
                  : isResend
                    ? 'Ready to resend; a new dispatch will be recorded.'
                    : 'Ready to generate and send.'}
            </Text>
          </Stack>
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

      {request.status === 'DRAFT' && !request.supplierId && (
        <Alert color="orange" variant="light" title="Add a provider before sending">
          This draft is saved, but its purchase order cannot be generated or sent yet. Select a
          provider in the Identification step below and save the changes to enable sending.
        </Alert>
      )}

      <Card withBorder>
        <Group justify="space-between" align="center">
          <div>
            <Title order={4}>Branch approval</Title>
            <Text size="sm" c="dimmed">
              {request.approvedBy && request.approvedAt
                ? `Approved by ${request.approvedBy.displayName?.trim() || request.approvedBy.email} on ${formatDateTime(request.approvedAt)}. Saving draft changes will clear this approval.`
                : 'No approval has been recorded. The Word signature line remains blank until signed.'}
            </Text>
          </div>
          {request.status === 'DRAFT' && canApprove && !request.approvedAt && (
            <Button
              variant="light"
              loading={approve.isPending}
              disabled={sendBlockers.length > 0}
              onClick={() =>
                approve.mutate(undefined, {
                  onSuccess: () =>
                    notifications.show({ color: 'green', message: 'Approval recorded' }),
                  onError: (error) =>
                    notifications.show({
                      color: 'red',
                      message: error instanceof Error ? error.message : 'Could not record approval',
                    }),
                })
              }
            >
              Record approval
            </Button>
          )}
        </Group>
      </Card>

      {request.status !== 'DRAFT' && (
        <Alert color="gray" variant="light">
          The order has already been issued. Operational instructions are locked. Voucher, invoice,
          actual cost, completion date and internal reconciliation notes can still be changed.
        </Alert>
      )}
      {request.sentAt && !request.issuedDocxKey && (
        <Alert color="yellow" variant="light">
          This order predates Word archiving. Its issued PDF is available in the dispatch history; a
          Word file cannot reliably reconstruct the original terms.
        </Alert>
      )}

      {request.status !== 'DRAFT' ? (
        <>
          <ServiceReconciliation
            request={request}
            saving={update.isPending}
            onSave={(values) =>
              update.mutate(values, {
                onSuccess: () =>
                  notifications.show({ message: 'Reconciliation saved', color: 'green' }),
                onError: (error) =>
                  notifications.show({
                    message: error instanceof Error ? error.message : 'Could not save',
                    color: 'red',
                  }),
              })
            }
          />
          {(request.status === 'SENT' || request.status === 'COMPLETED') && (
            <ServiceOrderReceipt key={request.updatedAt.toISOString()} request={request} />
          )}
        </>
      ) : (
        <ServiceRequestStepper
          request={request}
          type={request.type}
          initialStep={step === 'documents' ? 2 : 0}
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
      )}

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
                <Table.Th>Issued copies</Table.Th>
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
                  <Table.Td>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="subtle"
                        loading={dispatchDownloading === `${dispatch.id}-pdf`}
                        onClick={() => void downloadDispatch(dispatch.id, 'pdf')}
                      >
                        PDF
                      </Button>
                      {dispatch.hasWord && (
                        <Button
                          size="xs"
                          variant="subtle"
                          loading={dispatchDownloading === `${dispatch.id}-docx`}
                          onClick={() => void downloadDispatch(dispatch.id, 'docx')}
                        >
                          Word
                        </Button>
                      )}
                    </Group>
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
