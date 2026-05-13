import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect } from 'react';
import {
  Grid,
  Stack,
  Paper,
  Box,
  Text,
  ScrollArea,
  Loader,
  Center,
  Alert,
  Divider,
  NavLink,
  TextInput,
  Select,
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
  usePortsTree,
  useSavePort,
  useDeletePort,
  portsApi,
} from '../../../lib/api/master-data/ports';
import type { PortTreeNode } from '../../../lib/api/master-data/ports';

export const Route = createFileRoute('/_protected/master-data/ports')({
  component: PortsScreen,
});

// ---------------------------------------------------------------------------
// Recursive NavLink tree component
// ---------------------------------------------------------------------------

interface PortNavTreeProps {
  nodes: PortTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}

function PortNavTree({ nodes, selectedId, onSelect, depth = 0 }: PortNavTreeProps) {
  return (
    <>
      {nodes.map((node) => (
        <NavLink
          key={node.id}
          label={node.name}
          description={node.abbreviation ?? undefined}
          active={node.id === selectedId}
          onClick={() => onSelect(node.id)}
          pl={depth * 12 + 8}
          styles={{ root: { borderRadius: 4 } }}
          childrenOffset={0}
          defaultOpened={depth < 2}
        >
          {node.children.length > 0 && (
            <PortNavTree
              nodes={node.children}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </NavLink>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Flatten tree to ordered list (for Prior/Next/First/Last navigation)
// ---------------------------------------------------------------------------

function flattenTree(nodes: PortTreeNode[]): PortTreeNode[] {
  const result: PortTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

function PortsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { data: currentUser } = useCurrentUser();
  const isAdm = currentUser?.role === 'ADM';

  const treeQuery = usePortsTree();
  const savePort = useSavePort(selectedId);
  const deletePort = useDeletePort();

  const form = useForm<PortCreateInput>({
    resolver: zodResolver(PortCreateSchema),
  });

  const { handleSubmit, reset, formState, watch, setValue } = form;

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
          location: port.location ?? undefined,
          parentId: port.parentId ?? undefined,
          comments: port.comments ?? undefined,
        });
      })
      .catch(() => {
        setLoadError('Failed to load record. Please try again.');
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }, [selectedId, reset]);

  const onSubmit = useCallback(
    async (values: PortCreateInput) => {
      await savePort.mutateAsync(values);
      notifications.show({ message: 'Record saved successfully.', color: 'green' });
    },
    [savePort],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deletePort.mutateAsync(id);
      setSelectedId(null);
    },
    [deletePort],
  );

  // Navigation helpers over flattened tree
  const flatNodes = treeQuery.data ? flattenTree(treeQuery.data) : [];
  const currentIndex = selectedId !== null ? flatNodes.findIndex((n) => n.id === selectedId) : -1;
  const canNavigate = flatNodes.length > 1;

  function handleFirst() {
    const first = flatNodes[0];
    if (first) setSelectedId(first.id);
  }
  function handleLast() {
    const last = flatNodes[flatNodes.length - 1];
    if (last) setSelectedId(last.id);
  }
  function handlePrior() {
    if (currentIndex > 0) {
      const prior = flatNodes[currentIndex - 1];
      if (prior) setSelectedId(prior.id);
    }
  }
  function handleNext() {
    if (currentIndex >= 0 && currentIndex < flatNodes.length - 1) {
      const next = flatNodes[currentIndex + 1];
      if (next) setSelectedId(next.id);
    }
  }
  function handleNew() {
    setSelectedId(null);
    reset(undefined);
  }
  function handleCancel() {
    if (selectedId !== null) {
      setIsLoadingDetail(true);
      portsApi
        .get(selectedId)
        .then((port) => {
          reset({
            name: port.name,
            abbreviation: port.abbreviation ?? undefined,
            location: port.location ?? undefined,
            parentId: port.parentId ?? undefined,
            comments: port.comments ?? undefined,
          });
        })
        .catch(() => setLoadError('Failed to reload record.'))
        .finally(() => setIsLoadingDetail(false));
    } else {
      reset(undefined);
    }
  }

  // Build parent picker options from flat tree (excluding self)
  const parentOptions = flatNodes
    .filter((n) => n.id !== selectedId)
    .map((n) => ({ value: n.id, label: n.name }));

  const currentParentId = watch('parentId');

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      <FormProvider {...form}>
        <Grid h="100%" gutter={0}>
          {/* Left rail — hierarchical tree */}
          <Grid.Col
            span={3}
            style={{
              borderRight: '1px solid var(--mantine-color-gray-3)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            <Stack gap="xs" p="sm" style={{ flexShrink: 0 }}>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                Ports Hierarchy
              </Text>
            </Stack>

            <Divider />

            <ScrollArea flex={1} p="xs">
              {treeQuery.isPending && (
                <Center py="xl">
                  <Loader size="sm" />
                </Center>
              )}
              {treeQuery.isError && (
                <Text size="sm" c="red">
                  Failed to load hierarchy.
                </Text>
              )}
              {treeQuery.data && treeQuery.data.length === 0 && (
                <Text size="sm" c="dimmed" p="sm">
                  No ports found.
                </Text>
              )}
              {treeQuery.data && (
                <PortNavTree
                  nodes={treeQuery.data}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </ScrollArea>
          </Grid.Col>

          {/* Right panel — detail form */}
          <Grid.Col span={9}>
            <Stack h="100%" gap={0}>
              {/* Button bar */}
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

              {/* Form body */}
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
                    <PortFields
                      form={form}
                      parentOptions={parentOptions}
                      currentParentId={currentParentId ?? null}
                      onParentChange={(val) => setValue('parentId', val ?? undefined)}
                    />
                    <CommentarioField />
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

interface PortFieldsProps {
  form: ReturnType<typeof useForm<PortCreateInput>>;
  parentOptions: Array<{ value: string; label: string }>;
  currentParentId: string | null;
  onParentChange: (val: string | null) => void;
}

function PortFields({ form, parentOptions, currentParentId, onParentChange }: PortFieldsProps) {
  const { register, formState } = form;

  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Rotterdam"
        required
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <TextInput
        label="Abbreviation"
        placeholder="e.g. RTM"
        error={formState.errors.abbreviation?.message}
        {...register('abbreviation')}
      />
      <Box>
        <Select
          label="Parent (Country / Port)"
          placeholder="None — top-level entry"
          data={parentOptions}
          value={currentParentId}
          onChange={onParentChange}
          clearable
          searchable
          error={formState.errors.parentId?.message}
        />
      </Box>
    </Stack>
  );
}
