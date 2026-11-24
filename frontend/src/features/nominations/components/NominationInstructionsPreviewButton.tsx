import { lazy, Suspense, useState } from 'react';
import { Alert, Button, Center, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { nominationsApi } from '../api';

const PdfPreview = lazy(() => import('./NominationInstructionsPdfPreview'));

type InstructionKind = 'operational' | 'administrative';

export function NominationInstructionsPreviewButton({
  nominationId,
  kind,
  disabled = false,
}: {
  nominationId: string;
  kind: InstructionKind;
  disabled?: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const title =
    kind === 'operational'
      ? 'Nomination Instructions — SNCA-RG-AGN-001'
      : 'Nomination Instructions Administrativo — SNCA-RG-AGN-002';
  const preview = useQuery({
    queryKey: ['nomination-instructions-preview', nominationId, kind],
    queryFn: () => nominationsApi.nominationInstructionsPreview(nominationId, kind),
    enabled: opened,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return (
    <>
      <Button
        size="xs"
        variant="default"
        disabled={disabled}
        onClick={() => setOpened(true)}
        aria-label={`Preview ${title}`}
      >
        Preview
      </Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title={title} size="xl">
        <Stack gap="md">
          {preview.isFetching && (
            <Center mih={160}>
              <Loader size="sm" aria-label="Preparing document preview" />
            </Center>
          )}
          {preview.isError && (
            <Alert color="red" title="Preview unavailable">
              <Stack gap="xs">
                <Text size="sm">
                  The preview could not be prepared. Try again, or close this window and download
                  the Word document.
                </Text>
                <Group>
                  <Button size="xs" variant="light" onClick={() => void preview.refetch()}>
                    Try again
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}
          {preview.data && !preview.isFetching && !preview.isError && (
            <Suspense
              fallback={
                <Center mih={160}>
                  <Loader size="sm" />
                </Center>
              }
            >
              <PdfPreview document={preview.data} />
            </Suspense>
          )}
        </Stack>
      </Modal>
    </>
  );
}
