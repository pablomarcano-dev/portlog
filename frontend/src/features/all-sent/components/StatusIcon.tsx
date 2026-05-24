import { Tooltip, ThemeIcon } from '@mantine/core';
import type { CellStatus } from '@portlog/schemas';

interface StatusIconProps {
  cell: CellStatus;
}

/**
 * Renders a colored icon representing the dispatch status of a SH-xx document cell.
 *
 * - SENT:    green check
 * - FAILED:  red X
 * - PENDING with shDocumentId: amber dot (document exists, not yet sent)
 * - PENDING without shDocumentId: gray dash (no document created)
 */
export function StatusIcon({ cell }: StatusIconProps) {
  if (cell.status === 'SENT') {
    return (
      <Tooltip label={`Sent at ${new Date(cell.sentAt).toLocaleString()}`} withArrow>
        <ThemeIcon color="green" variant="light" size="sm" radius="xl" aria-label="Sent">
          ✓
        </ThemeIcon>
      </Tooltip>
    );
  }

  if (cell.status === 'FAILED') {
    return (
      <Tooltip label={`Failed: ${cell.error}`} withArrow multiline maw={300}>
        <ThemeIcon color="red" variant="light" size="sm" radius="xl" aria-label="Failed">
          ✗
        </ThemeIcon>
      </Tooltip>
    );
  }

  // PENDING
  if (cell.shDocumentId) {
    return (
      <Tooltip label="Document exists — not yet sent" withArrow>
        <ThemeIcon color="yellow" variant="light" size="sm" radius="xl" aria-label="Pending">
          •
        </ThemeIcon>
      </Tooltip>
    );
  }

  return (
    <Tooltip label="No document created" withArrow>
      <ThemeIcon color="gray" variant="subtle" size="sm" radius="xl" aria-label="No document">
        —
      </ThemeIcon>
    </Tooltip>
  );
}
