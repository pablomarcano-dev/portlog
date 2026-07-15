/**
 * MasterDetailShell — Reusable master/detail layout for all M2 master-data screens.
 *
 * ## Usage
 * ```tsx
 * <MasterDetailShell
 *   entityKey="flags"
 *   schema={FlagCreateSchema}
 *   listQuery={flagsQuery}
 *   selectedId={selectedId}
 *   onSelect={setSelectedId}
 *   loadById={flagsApi.get}
 *   onSave={async (values) => { await createOrUpdate(values); }}
 *   onDelete={async (id) => { await flagsApi.delete(id); }}
 *   searchFn={async (q) => flagsApi.search(q)}
 * >
 *   {(form) => (
 *     <>
 *       <TextInput label="Name" {...form.register('name')} />
 *     </>
 *   )}
 * </MasterDetailShell>
 * ```
 *
 * ## Shell responsibilities
 * - Owns the `<FormProvider>` so child fields call `useFormContext()` normally.
 * - Always renders `<CommentarioField>` — entity forms must NOT add their own `comments` field.
 * - Owns list navigation (Prior/Next/First/Last) since it owns the list state.
 * - `Delete` button is only visible when `user.role === 'ADM'`.
 * - Calls `notifications.show` on successful save.
 *
 * ## Entity form contract
 * The `children` render-prop receives the `UseFormReturn<TForm>` instance.
 * The TForm Zod schema MUST include an optional `comments` field (string | null | undefined).
 * Entity forms render only their domain-specific fields inside the children slot.
 */

import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useForm, FormProvider } from 'react-hook-form';
import type { UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType, ZodTypeDef } from 'zod';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '../../lib/auth/queries';
import { FlashSearch } from './FlashSearch';
import type { FlashSearchResult } from './FlashSearch';
import { CommentarioField } from './CommentarioField';
import { ButtonBar } from './ButtonBar';

export interface ListItem {
  id: string;
  label: string;
}

export interface MasterDetailShellProps<TForm extends FieldValues> {
  /** Unique key for this entity type — used for query keys and aria labels. */
  entityKey: string;
  /** Zod schema for the form. Must include an optional `comments` field. */
  schema: ZodType<TForm, ZodTypeDef, unknown>;
  /** TanStack Query result providing the full list of records. */
  listQuery: UseQueryResult<{ items: ListItem[] }>;
  /** Currently selected record id, or null if none selected / new record. */
  selectedId: string | null;
  /** Called when user selects a list item or when shell navigates (Prior/Next/etc). */
  onSelect: (id: string | null) => void;
  /** Async function that returns form default values for a given id. */
  loadById: (id: string) => Promise<TForm>;
  /** Called on form submission. Receives validated form values. */
  onSave: (values: TForm) => Promise<void>;
  /** Called after delete confirmation. ADM only. */
  onDelete?: (id: string) => Promise<void>;
  /** Optional print handler (no-op in M2; PDF generation deferred to M4). */
  onPrint?: () => void;
  /** Search function for the Flash Search panel. Debounced 300ms by FlashSearch. */
  searchFn: (q: string) => Promise<FlashSearchResult[]>;
  /** Render-prop slot for entity-specific form fields. Receives the form instance. */
  children: (form: UseFormReturn<TForm>) => ReactNode;
}

/**
 * Main reusable shell. Generic over TForm to carry Zod/RHF types end-to-end.
 */
export function MasterDetailShell<TForm extends FieldValues>({
  entityKey,
  schema,
  listQuery,
  selectedId,
  onSelect,
  loadById,
  onSave,
  onDelete,
  onPrint,
  searchFn,
  children,
}: MasterDetailShellProps<TForm>) {
  const { data: currentUser } = useCurrentUser();
  const isAdm = currentUser?.role === 'ADM';

  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const form = useForm<TForm>({
    resolver: zodResolver(schema),
  });

  const { handleSubmit, reset, formState } = form;

  // Load detail data whenever selectedId changes
  useEffect(() => {
    if (selectedId === null) {
      reset(undefined);
      setLoadError(null);
      return;
    }
    setIsLoadingDetail(true);
    setLoadError(null);
    loadById(selectedId)
      .then((values) => {
        reset(values);
      })
      .catch(() => {
        setLoadError('Failed to load record. Please try again.');
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }, [selectedId, loadById, reset]);

  const onSubmit = useCallback(
    async (values: TForm) => {
      try {
        await onSave(values);
      } catch (err: unknown) {
        notifications.show({
          color: 'red',
          title: 'Save failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
        return;
      }
      notifications.show({
        message: 'Record saved successfully.',
        color: 'green',
      });
    },
    [onSave],
  );

  // List navigation helpers
  const items = listQuery.data?.items ?? [];

  const currentIndex = selectedId !== null ? items.findIndex((i) => i.id === selectedId) : -1;

  function handleFirst() {
    const first = items[0];
    if (first) onSelect(first.id);
  }

  function handleLast() {
    const last = items[items.length - 1];
    if (last) onSelect(last.id);
  }

  function handlePrior() {
    if (currentIndex > 0) {
      const prior = items[currentIndex - 1];
      if (prior) onSelect(prior.id);
    }
  }

  function handleNext() {
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
      const next = items[currentIndex + 1];
      if (next) onSelect(next.id);
    }
  }

  function handleNew() {
    onSelect(null);
    reset(undefined);
  }

  function handleCancel() {
    if (selectedId !== null) {
      // Re-load the last persisted values
      setIsLoadingDetail(true);
      loadById(selectedId)
        .then((values) => {
          reset(values);
        })
        .catch(() => {
          setLoadError('Failed to reload record.');
        })
        .finally(() => {
          setIsLoadingDetail(false);
        });
    } else {
      reset(undefined);
    }
  }

  const canNavigate = items.length > 1;

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate style={{ height: '100%' }}>
      <FormProvider {...form}>
        <Grid h="100%" gutter={0} styles={{ inner: { height: '100%', minHeight: 0 } }}>
          {/* Left rail — record list + Flash Search */}
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
                Flash Search
              </Text>
              <FlashSearch
                searchFn={searchFn}
                onSelect={onSelect}
                selectedId={selectedId}
                placeholder={`Search ${entityKey}...`}
              />
            </Stack>

            <Divider />

            <ScrollArea flex={1} p="sm">
              {listQuery.isPending && (
                <Center py="xl">
                  <Loader size="sm" />
                </Center>
              )}
              {listQuery.isError && (
                <Text size="sm" c="red">
                  Failed to load list.
                </Text>
              )}
              {!listQuery.isPending && items.length === 0 && (
                <Text size="sm" c="dimmed">
                  No records found.
                </Text>
              )}
              <Stack gap={0}>
                {items.map((item) => (
                  <Box
                    key={item.id}
                    px="sm"
                    py="xs"
                    style={{
                      cursor: 'pointer',
                      borderRadius: 4,
                      backgroundColor:
                        item.id === selectedId ? 'var(--mantine-color-blue-1)' : undefined,
                    }}
                    onClick={() => onSelect(item.id)}
                  >
                    <Text size="sm" fw={item.id === selectedId ? 600 : 400}>
                      {item.label}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          </Grid.Col>

          {/* Right panel — detail form */}
          <Grid.Col span={9} style={{ height: '100%', minHeight: 0 }}>
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
                  onPrint={onPrint}
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
                    {/* Entity-specific fields slot */}
                    {children(form)}
                    {/* Comentarios — always rendered, always bound to `comments` */}
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
