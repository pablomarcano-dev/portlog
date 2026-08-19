import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Alert, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';
import { ServiceRequestTypeSchema } from '@portlog/schemas';
import { ServiceRequestStepper } from '../../../features/service-requests/components/ServiceRequestStepper';
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

  return (
    <Stack p="xl" gap="md">
      {user && user.branchId === null && (
        <Alert color="yellow" variant="light" title="No branch assigned">
          Your account has no default branch, so the Branch field is not pre-filled. An
          administrator can assign one in Admin → Users.
        </Alert>
      )}

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
              void navigate({ to: '/service-requests/$id', params: { id: created.id } });
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
