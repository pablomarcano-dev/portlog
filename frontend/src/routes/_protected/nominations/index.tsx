import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Stack, Group, Title, Button, Alert, Pagination, Text, Switch } from '@mantine/core';
import { useState } from 'react';
import { NominationListQuerySchema } from '@portlog/schemas';
import type { NominationListItem, NominationListQuery, NominationStatus } from '@portlog/schemas';
import { NominationFilters } from '../../../features/nominations/components/NominationFilters';
import { NominationTable } from '../../../features/nominations/components/NominationTable';
import { useNominationList } from '../../../features/nominations/hooks/useNominationList';

// Statuses considered "active" — nominations the OPS team is actively working on
const ACTIVE_STATUSES: NominationStatus[] = ['IN_PROGRESS', 'CONFIRMED'];

export const Route = createFileRoute('/_protected/nominations/')({
  validateSearch: (search) => NominationListQuerySchema.parse(search),
  component: NominationListPage,
});

function NominationListPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  // Default to showing active nominations only; user can toggle to see all
  const [activeOnly, setActiveOnly] = useState(true);

  const { data, isLoading, isError, refetch } = useNominationList(search);

  // Client-side active filter — applied on top of any server-side status filter
  const filteredItems: NominationListItem[] = (() => {
    const items = data?.items ?? [];
    if (!activeOnly) return items;
    return items.filter((item) => ACTIVE_STATUSES.includes(item.status));
  })();

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
        <Title order={2}>Nominated Vessels</Title>
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

      <Group justify="flex-end">
        <Switch
          label="Active nominations only (In Progress + Confirmed)"
          checked={activeOnly}
          onChange={(e) => setActiveOnly(e.currentTarget.checked)}
          size="sm"
        />
      </Group>

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

      <NominationTable
        items={filteredItems}
        isLoading={isLoading}
        onRowClick={(id) => void navigate({ to: '/nominations/$id', params: { id } })}
      />

      {data && data.total > 0 && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {activeOnly
              ? `${filteredItems.length} active nomination${filteredItems.length !== 1 ? 's' : ''} (of ${data.total} total)`
              : `${data.total} nomination${data.total !== 1 ? 's' : ''} found`}
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
