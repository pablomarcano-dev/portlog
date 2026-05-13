import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Stack, Group, Title, Button, Alert, Pagination, Text } from '@mantine/core';
import { NominationListQuerySchema } from '@portlog/schemas';
import type { NominationListQuery } from '@portlog/schemas';
import { NominationFilters } from '../../../features/nominations/components/NominationFilters';
import { NominationTable } from '../../../features/nominations/components/NominationTable';
import { useNominationList } from '../../../features/nominations/hooks/useNominationList';

export const Route = createFileRoute('/_protected/nominations/')({
  validateSearch: (search) => NominationListQuerySchema.parse(search),
  component: NominationListPage,
});

function NominationListPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const { data, isLoading, isError, refetch } = useNominationList(search);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  function setSearch(updates: Partial<NominationListQuery>) {
    const next: NominationListQuery = { ...search, ...updates };
    void navigate({ to: '/nominations', search: next });
  }

  function handleClear() {
    void navigate({ to: '/nominations', search: { page: 1, pageSize: search.pageSize } });
  }

  return (
    <Stack p="xl" gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Nominations</Title>
        {/* Route /nominations/new will be created in the next story (POR-56) */}
        <Button component="a" href="/nominations/new">
          New Nomination
        </Button>
      </Group>

      <NominationFilters
        status={search.status}
        portId={search.portId}
        shipParticularId={search.shipParticularId}
        dateFrom={search.dateFrom}
        dateTo={search.dateTo}
        search={search.search}
        onStatusChange={(val) => setSearch({ status: val, page: 1 })}
        onPortChange={(val) => setSearch({ portId: val, page: 1 })}
        onVesselChange={(val) => setSearch({ shipParticularId: val, page: 1 })}
        onDateFromChange={(val) => setSearch({ dateFrom: val, page: 1 })}
        onDateToChange={(val) => setSearch({ dateTo: val, page: 1 })}
        onSearchChange={(val) => setSearch({ search: val, page: 1 })}
        onClear={handleClear}
      />

      {isError && (
        <Alert color="red" title="Failed to load nominations" withCloseButton={false}>
          <Group gap="sm">
            <Text size="sm">Something went wrong. Please try again.</Text>
            <Button variant="subtle" size="xs" color="red" onClick={() => void refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      )}

      <NominationTable items={data?.items ?? []} isLoading={isLoading} />

      {data && data.total > 0 && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {data.total} nomination{data.total !== 1 ? 's' : ''} found
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
