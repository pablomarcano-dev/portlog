import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect } from 'react';
import {
  Grid,
  Stack,
  Paper,
  Text,
  ScrollArea,
  Loader,
  Center,
  Alert,
  Divider,
  NavLink,
  TextInput,
  ActionIcon,
  Group,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PortCreateSchema } from '@portlog/schemas';
import type { PortCreateInput } from '@portlog/schemas';
import { useCurrentUser } from '../../../lib/auth/queries';
import { ButtonBar } from '../../../components/master-data/ButtonBar';
import { CommentarioField } from '../../../components/master-data/CommentarioField';
import {
  useSavePort,
  useDeletePort,
  usePiers,
  useSavePier,
  portsApi,
  piersApi,
} from '../../../lib/api/master-data/ports';
import type { PortRecord } from '../../../lib/api/master-data/ports';

export const Route = createFileRoute('/_protected/master-data/ports')({
  component: PortsScreen,
});

// ---------------------------------------------------------------------------
// Simple flat port list for the left rail
// ---------------------------------------------------------------------------

interface FlatPortItem {
  id: string;
  name: string;
  abbreviation?: string | null;
}

function PortNavList({
  items,
  selectedId,
  onSelect,
}: {
  items: FlatPortItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {items.map((p) => (
        <NavLink
          key={p.id}
          label={p.name}
          description={p.abbreviation ?? undefined}
          active={p.id === selectedId}
          onClick={() => onSelect(p.id)}
          pl={8}
          styles={{ root: { borderRadius: 4 } }}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pier list editor — inline add/remove
// ---------------------------------------------------------------------------

interface PierListEditorProps {
  portId: string;
  pendingDeletes: string[];
  onMarkDelete: (pierId: string) => void;
}

function PierListEditor({ portId, pendingDeletes, onMarkDelete }: PierListEditorProps) {
  const piersQuery = usePiers(portId);
  const savePier = useSavePier(portId);
  const [newName, setNewName] = useState('');

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    await savePier.mutateAsync({ name });
    setNewName('');
  }

  const visiblePiers = (piersQuery.data?.items ?? []).filter((p) => !pendingDeletes.includes(p.id));

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Piers
      </Text>
      {piersQuery.isPending && <Loader size="xs" />}
      {visiblePiers.map((pier) => (
        <Group key={pier.id} justify="space-between" gap="xs">
          <Text size="sm">{pier.name}</Text>
          <ActionIcon
            type="button"
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => onMarkDelete(pier.id)}
          >
            ×
          </ActionIcon>
        </Group>
      ))}
      <Group gap="xs" align="flex-end">
        <TextInput
          size="xs"
          placeholder="New pier name…"
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAdd();
            }
          }}
          style={{ flex: 1 }}
        />
        <ActionIcon
          type="button"
          size="sm"
          variant="light"
          onClick={() => void handleAdd()}
          loading={savePier.isPending}
          disabled={!newName.trim()}
        >
          +
        </ActionIcon>
      </Group>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function PortsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [portList, setPortList] = useState<FlatPortItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingPierDeletes, setPendingPierDeletes] = useState<string[]>([]);

  const { data: currentUser } = useCurrentUser();
  const isAdm = currentUser?.role === 'ADM';

  const savePort = useSavePort(selectedId);
  const deletePort = useDeletePort();

  const form = useForm<PortCreateInput>({
    resolver: zodResolver(PortCreateSchema),
  });

  const { handleSubmit, reset, formState } = form;

  // Load flat port list on mount
  useEffect(() => {
    setIsLoadingList(true);
    portsApi
      .list({ limit: 200 })
      .then((res) => setPortList(res.items))
      .catch(() => setPortList([]))
      .finally(() => setIsLoadingList(false));
  }, []);

  // Reload list helper
  const reloadList = useCallback(() => {
    portsApi
      .list({ limit: 200 })
      .then((res) => setPortList(res.items))
      .catch(() => null);
  }, []);

  // Reset pending pier deletes when navigating to a different port
  useEffect(() => {
    setPendingPierDeletes([]);
  }, [selectedId]);

  // Load detail whenever selectedId changes
  useEffect(() => {
    if (selectedId === null) {
      reset(undefined);
      setLoadError(null);
      return;
    }
    setIsLoadingDetail(true);
    setLoadError(null);
    portsApi
      .get(selectedId)
      .then((port) => {
        reset({
          name: port.name,
          abbreviation: port.abbreviation ?? undefined,
          country: port.country ?? undefined,
          emailGroup: port.emailGroup ?? undefined,
          comments: port.comments ?? undefined,
        });
      })
      .catch(() => setLoadError('Failed to load record. Please try again.'))
      .finally(() => setIsLoadingDetail(false));
  }, [selectedId, reset]);

  const onSubmit = useCallback(
    async (values: PortCreateInput) => {
      let result: PortRecord;
      try {
        result = await savePort.mutateAsync(values);
      } catch {
        // useSavePort's onError already shows the failure notification.
        return;
      }
      const portId = selectedId ?? result.id;
      await Promise.all(pendingPierDeletes.map((pierId) => piersApi.delete(portId, pierId)));
      setPendingPierDeletes([]);
      notifications.show({ message: 'Record saved successfully.', color: 'green' });
      if (selectedId === null) {
        setSelectedId(portId);
      }
      reloadList();
    },
    [savePort, selectedId, pendingPierDeletes, reloadList],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deletePort.mutateAsync(id);
      setSelectedId(null);
      reloadList();
    },
    [deletePort, reloadList],
  );

  const currentIndex = selectedId !== null ? portList.findIndex((n) => n.id === selectedId) : -1;
  const canNavigate = portList.length > 1;

  function handleFirst() {
    const f = portList[0];
    if (f) setSelectedId(f.id);
  }
  function handleLast() {
    const l = portList[portList.length - 1];
    if (l) setSelectedId(l.id);
  }
  function handlePrior() {
    if (currentIndex > 0) setSelectedId(portList[currentIndex - 1]!.id);
  }
  function handleNext() {
    if (currentIndex >= 0 && currentIndex < portList.length - 1)
      setSelectedId(portList[currentIndex + 1]!.id);
  }
  function handleNew() {
    setSelectedId(null);
    reset(undefined);
  }
  function handleCancel() {
    setPendingPierDeletes([]);
    if (selectedId !== null) {
      setIsLoadingDetail(true);
      portsApi
        .get(selectedId)
        .then((port) =>
          reset({
            name: port.name,
            abbreviation: port.abbreviation ?? undefined,
            country: port.country ?? undefined,
            emailGroup: port.emailGroup ?? undefined,
            comments: port.comments ?? undefined,
          }),
        )
        .catch(() => setLoadError('Failed to reload record.'))
        .finally(() => setIsLoadingDetail(false));
    } else {
      reset(undefined);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate style={{ height: '100%' }}>
      <FormProvider {...form}>
        <Grid h="100%" gutter={0} styles={{ inner: { height: '100%', minHeight: 0 } }}>
          {/* Left rail — flat port list */}
          <Grid.Col
            span={3}
            style={{
              borderRight: '1px solid var(--mantine-color-gray-3)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
            }}
          >
            <Stack gap="xs" p="sm" style={{ flexShrink: 0 }}>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                Port List
              </Text>
            </Stack>
            <Divider />
            <ScrollArea flex={1} p="xs">
              {isLoadingList && (
                <Center py="xl">
                  <Loader size="sm" />
                </Center>
              )}
              {!isLoadingList && portList.length === 0 && (
                <Text size="sm" c="dimmed" p="sm">
                  No ports found.
                </Text>
              )}
              <PortNavList items={portList} selectedId={selectedId} onSelect={setSelectedId} />
            </ScrollArea>
          </Grid.Col>

          {/* Right panel — detail form */}
          <Grid.Col span={9} style={{ height: '100%', minHeight: 0 }}>
            <Stack h="100%" gap={0}>
              <Paper
                px="md"
                py="xs"
                style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
              >
                <ButtonBar
                  isAdm={isAdm}
                  isSubmitting={formState.isSubmitting}
                  isDirty={formState.isDirty}
                  canNavigate={canNavigate}
                  onPrior={handlePrior}
                  onNext={handleNext}
                  onFirst={handleFirst}
                  onLast={handleLast}
                  onNew={handleNew}
                  onDelete={onDelete}
                  onCancel={handleCancel}
                  selectedId={selectedId}
                />
              </Paper>

              <ScrollArea flex={1} p="md">
                {isLoadingDetail && (
                  <Center py="xl">
                    <Loader size="sm" />
                  </Center>
                )}
                {loadError !== null && (
                  <Alert color="red" mb="md">
                    {loadError}
                  </Alert>
                )}
                {!isLoadingDetail && (
                  <Stack gap="md">
                    <PortFields form={form} />
                    <CommentarioField />
                    {selectedId !== null && (
                      <>
                        <Divider />
                        <PierListEditor
                          portId={selectedId}
                          pendingDeletes={pendingPierDeletes}
                          onMarkDelete={(id) => setPendingPierDeletes((prev) => [...prev, id])}
                        />
                      </>
                    )}
                  </Stack>
                )}
              </ScrollArea>
            </Stack>
          </Grid.Col>
        </Grid>
      </FormProvider>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Port entity fields
// ---------------------------------------------------------------------------

function PortFields({ form }: { form: ReturnType<typeof useForm<PortCreateInput>> }) {
  const { register, formState } = form;

  return (
    <Stack gap="sm">
      <Grid gutter="sm">
        <Grid.Col span={8}>
          <TextInput
            label="Name"
            placeholder="e.g. Rotterdam"
            required
            error={formState.errors.name?.message}
            {...register('name')}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput
            label="Acronym"
            placeholder="e.g. RTM"
            error={formState.errors.abbreviation?.message}
            {...register('abbreviation')}
          />
        </Grid.Col>
      </Grid>
      <Grid gutter="sm">
        <Grid.Col span={6}>
          <TextInput
            label="Country"
            placeholder="e.g. Netherlands"
            error={formState.errors.country?.message}
            {...register('country')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Email Group"
            placeholder="e.g. rotterdam-ops"
            error={formState.errors.emailGroup?.message}
            {...register('emailGroup')}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
