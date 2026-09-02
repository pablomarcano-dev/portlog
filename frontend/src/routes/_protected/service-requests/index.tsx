import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Alert,
  Button,
  Group,
  Menu,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  ServiceRequestListSearchSchema,
  toSelectOptions,
  type ServiceRequestListSearch,
  type ServiceRequestType,
} from '@portlog/schemas';
import { ServiceRequestTable } from '../../../features/service-requests/components/ServiceRequestTable';
import { getBranchAssignmentGuidance } from '../../../features/service-requests/branchAssignment';
import { useServiceRequestList } from '../../../features/service-requests/hooks';
import { useCurrentUser } from '../../../lib/auth/queries';

export const Route = createFileRoute('/_protected/service-requests/')({
  validateSearch: (search) => ServiceRequestListSearchSchema.parse(search),
  component: ServiceRequestListPage,
});

const TYPE_OPTIONS = toSelectOptions(SERVICE_REQUEST_TYPE_LABELS);
const STATUS_OPTIONS = toSelectOptions(SERVICE_REQUEST_STATUS_LABELS);

/**
 * The Service Requests main screen — one table across every service type, with
 * the per-type form reached by picking a type from "New request".
 */
function ServiceRequestListPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: user } = useCurrentUser();

  const { data, isLoading, isError, refetch } = useServiceRequestList(search);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const branchRequired = user?.branchId === null;
  const branchGuidance = user ? getBranchAssignmentGuidance(user.role) : null;

  function setSearch(updates: Partial<ServiceRequestListSearch>) {
    void navigate({ to: '/service-requests', search: { ...search, ...updates } });
  }

  return (
    <Stack p="xl" gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Service Requests</Title>
        <Menu position="bottom-end">
          <Menu.Target>
            <Button disabled={branchRequired}>New request</Button>
          </Menu.Target>
          <Menu.Dropdown>
            {TYPE_OPTIONS.map((option) => (
              <Menu.Item
                key={option.value}
                onClick={() =>
                  void navigate({
                    to: '/service-requests/new',
                    search: { type: option.value as ServiceRequestType },
                  })
                }
              >
                {option.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {branchRequired && branchGuidance && (
        <Alert color="yellow" variant="light" title="A branch is required to create requests">
          <Group justify="space-between" align="center">
            <Text size="sm">{branchGuidance.message}</Text>
            {branchGuidance.canManageUsers && (
              <Button
                variant="light"
                color="yellow"
                size="xs"
                onClick={() => void navigate({ to: '/admin/users' })}
              >
                Manage users
              </Button>
            )}
          </Group>
        </Alert>
      )}

      <Group align="flex-end" gap="sm">
        <TextInput
          label="Search"
          placeholder="Control number, vessel, provider or voucher"
          value={search.search ?? ''}
          onChange={(e) => setSearch({ search: e.currentTarget.value || undefined, page: 1 })}
          w={280}
        />
        <Select
          label="Type"
          placeholder="All"
          data={TYPE_OPTIONS}
          clearable
          value={search.type ?? null}
          onChange={(val) => setSearch({ type: (val as ServiceRequestType) ?? undefined, page: 1 })}
          w={230}
        />
        <Select
          label="Status"
          placeholder="All"
          data={STATUS_OPTIONS}
          clearable
          value={search.status ?? null}
          onChange={(val) =>
            setSearch({
              status: (val as ServiceRequestListSearch['status']) ?? undefined,
              page: 1,
            })
          }
          w={170}
        />
        <Button
          variant="subtle"
          onClick={() =>
            void navigate({
              to: '/service-requests',
              search: { page: 1, pageSize: search.pageSize },
            })
          }
        >
          Clear
        </Button>
      </Group>

      {isError && (
        <Alert color="red" title="Could not load service requests">
          <Group gap="sm">
            <Text size="sm">Something went wrong. Please try again.</Text>
            <Button variant="subtle" size="xs" color="red" onClick={() => void refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      )}

      <ServiceRequestTable
        items={data?.items ?? []}
        isLoading={isLoading}
        onRowClick={(id) => void navigate({ to: '/service-requests/$id', params: { id } })}
      />

      {data && data.total > 0 && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {data.total} request{data.total !== 1 ? 's' : ''}
          </Text>
          <Pagination
            total={totalPages}
            value={search.page}
            onChange={(page) => setSearch({ page })}
          />
        </Group>
      )}
    </Stack>
  );
}
