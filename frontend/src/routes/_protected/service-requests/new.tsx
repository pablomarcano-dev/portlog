import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { ServiceRequestTypeSchema, requiresAuthorizationDocument } from '@portlog/schemas';
import { ServiceRequestStepper } from '../../../features/service-requests/components/ServiceRequestStepper';
import { getBranchAssignmentGuidance } from '../../../features/service-requests/branchAssignment';
import { useCreateServiceRequest } from '../../../features/service-requests/hooks';
import { useCurrentUser } from '../../../lib/auth/queries';

const NewSearchSchema = z.object({
  /** Which of the six forms to show; picked from the list screen's menu. */
  type: ServiceRequestTypeSchema.default('LAUNCH'),
});

export const Route = createFileRoute('/_protected/service-requests/new')({
  validateSearch: (search) => NewSearchSchema.parse(search),
  component: NewServiceRequestPage,
});

function NewServiceRequestPage() {
  const navigate = useNavigate();
  const { type } = Route.useSearch();
  const { data: user } = useCurrentUser();
  const create = useCreateServiceRequest();

  if (user?.branchId === null) {
    const guidance = getBranchAssignmentGuidance(user.role);

    return (
      <Stack p="xl" gap="md">
        <Title order={2}>New service request</Title>
        <Alert color="yellow" variant="light" title="A branch is required to create requests">
          <Stack gap="sm">
            <Text size="sm">{guidance.message}</Text>
            <Group>
              <Button
                variant="default"
                onClick={() =>
                  void navigate({ to: '/service-requests', search: { page: 1, pageSize: 25 } })
                }
              >
                Back to service requests
              </Button>
              {guidance.canManageUsers && (
                <Button onClick={() => void navigate({ to: '/admin/users' })}>Manage users</Button>
              )}
            </Group>
          </Stack>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack p="xl" gap="md">
      <ServiceRequestStepper
        type={type}
        defaultBranchId={user?.branchId ?? null}
        isSaving={create.isPending}
        onCancel={() =>
          void navigate({ to: '/service-requests', search: { page: 1, pageSize: 25 } })
        }
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (created) => {
              notifications.show({
                color: 'green',
                title: 'Service request created',
                message: `Control number ${created.controlNumber}`,
              });
              void navigate({
                to: '/service-requests/$id',
                params: { id: created.id },
                search: requiresAuthorizationDocument(values.details) ? { step: 'documents' } : {},
              });
            },
            onError: (err) =>
              notifications.show({
                color: 'red',
                title: 'Could not create the request',
                message: err instanceof Error ? err.message : 'Please try again',
              }),
          })
        }
      />
    </Stack>
  );
}
