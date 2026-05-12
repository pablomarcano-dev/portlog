import { Button, Group, Modal, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export interface ButtonBarProps {
  isAdm: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  canNavigate: boolean;
  onPrint?: () => void;
  onPrior: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  onNew: () => void;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
  selectedId: string | null;
}

/**
 * Standard 9-button action bar for master-data detail forms.
 * Renders: Print, Prior, Next, First, Last, New, Delete (ADM-only), Cancel, Accept.
 * Delete triggers a confirmation modal before calling onDelete.
 */
export function ButtonBar({
  isAdm,
  isSubmitting,
  isDirty,
  canNavigate,
  onPrint,
  onPrior,
  onNext,
  onFirst,
  onLast,
  onNew,
  onDelete,
  onCancel,
  selectedId,
}: ButtonBarProps) {
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  async function handleConfirmDelete() {
    if (onDelete && selectedId) {
      await onDelete(selectedId);
    }
    closeDelete();
  }

  return (
    <>
      <Group gap="xs" wrap="wrap">
        <Button variant="default" size="xs" onClick={onPrint} disabled={!selectedId} title="Print">
          Print
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={onPrior}
          disabled={!canNavigate}
          title="Prior record"
        >
          Prior
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={onNext}
          disabled={!canNavigate}
          title="Next record"
        >
          Next
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={onFirst}
          disabled={!canNavigate}
          title="First record"
        >
          First
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={onLast}
          disabled={!canNavigate}
          title="Last record"
        >
          Last
        </Button>
        <Button variant="default" size="xs" onClick={onNew} title="New record">
          New
        </Button>
        {isAdm && (
          <Button
            variant="default"
            size="xs"
            color="red"
            onClick={openDelete}
            disabled={!selectedId || !onDelete}
            title="Delete record"
          >
            Delete
          </Button>
        )}
        <Button
          variant="default"
          size="xs"
          onClick={onCancel}
          disabled={!isDirty}
          title="Cancel changes"
        >
          Cancel
        </Button>
        <Button size="xs" type="submit" loading={isSubmitting} title="Accept / Save">
          Accept
        </Button>
      </Group>

      <Modal opened={deleteOpened} onClose={closeDelete} title="Confirm Delete" centered size="sm">
        <Text size="sm" mb="md">
          Are you sure you want to delete this record? This action cannot be undone.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" size="sm" onClick={closeDelete}>
            Cancel
          </Button>
          <Button color="red" size="sm" onClick={() => void handleConfirmDelete()}>
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
}
