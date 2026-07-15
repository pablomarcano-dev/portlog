import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useMemo } from 'react';
import { Stack, TextInput } from '@mantine/core';
import { ActivityCreateSchema } from '@portlog/schemas';
import type { ActivityCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useActivitiesInfinite,
  useSaveActivity,
  useDeleteActivity,
  activitiesApi,
} from '../../../lib/api/master-data/activities';

export const Route = createFileRoute('/_protected/master-data/activities')({
  component: ActivitiesScreen,
});

function ActivitiesScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useActivitiesInfinite();
  const saveActivity = useSaveActivity(selectedId);
  const deleteActivity = useDeleteActivity();

  const activities = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: activities.map((a): ListItem => ({ id: a.id, label: a.name })),
        }
      : undefined,
  } as unknown as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<ActivityCreateInput> => {
    const activity = await activitiesApi.get(id);
    return {
      name: activity.name,
      comments: activity.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: ActivityCreateInput) => {
      await saveActivity.mutateAsync(values);
    },
    [saveActivity],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteActivity.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteActivity],
  );

  const searchFn = useCallback(async (q: string) => {
    return activitiesApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="activities"
      schema={ActivityCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
      hasMore={listQuery.hasNextPage}
      isLoadingMore={listQuery.isFetchingNextPage}
      onLoadMore={() => void listQuery.fetchNextPage()}
    >
      {(form) => (
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. Loading"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
        </Stack>
      )}
    </MasterDetailShell>
  );
}
