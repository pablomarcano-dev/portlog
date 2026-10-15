import { useEffect, useState } from 'react';
import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { downloadAttachment } from '../../lib/api/attachments';

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
}

/** Fetch the stored bytes, so operators verify what will actually be sent. */
export function AttachmentPreviewButton({
  attachment,
  onPreviewOpenChange,
}: {
  attachment: Attachment;
  onPreviewOpenChange: (opened: boolean) => void;
}) {
  const [opened, setOpened] = useState(false);
  function setPreviewOpened(nextOpened: boolean) {
    setOpened(nextOpened);
    onPreviewOpenChange(nextOpened);
  }
  // Sending or navigating can unmount the upload row while its preview is
  // open. Restore the owner's handlers for the next time it is shown.
  useEffect(() => () => onPreviewOpenChange(false), [onPreviewOpenChange]);
  const [url, setUrl] = useState<string | null>(null);
  const file = useQuery({
    queryKey: ['attachment-preview', attachment.id],
    queryFn: () => downloadAttachment(attachment.id),
    enabled: opened,
    gcTime: 0,
  });

  useEffect(() => {
    if (!opened || !file.data) return;
    // Chrome's native PDF viewer cannot render inside an HTML sandbox. Pin
    // the Blob type before giving it a frame, so even a mismatched response
    // cannot be interpreted as active HTML on the application's origin.
    const previewData =
      attachment.mimeType === 'application/pdf'
        ? new Blob([file.data], { type: 'application/pdf' })
        : file.data;
    const objectUrl = URL.createObjectURL(previewData);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [opened, file.data, attachment.mimeType]);

  const isImage = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(
    attachment.mimeType,
  );
  return (
    <>
      <Button
        size="compact-xs"
        variant="subtle"
        onClick={() => setPreviewOpened(true)}
        aria-label={`Verify ${attachment.filename}`}
      >
        Verify
      </Button>
      <Modal
        opened={opened}
        onClose={() => setPreviewOpened(false)}
        title={attachment.filename}
        size="xl"
      >
        <Stack>
          {file.isLoading && <Loader size="sm" />}
          {file.isError && <Alert color="red">Could not load this attachment. Try again.</Alert>}
          {url && (
            <>
              {attachment.mimeType === 'application/pdf' ? (
                <iframe
                  title={`Preview ${attachment.filename}`}
                  src={url}
                  style={{ width: '100%', height: '65vh', border: 0 }}
                />
              ) : isImage ? (
                <img
                  src={url}
                  alt={attachment.filename}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                />
              ) : (
                <Text size="sm">Download this file to verify its contents.</Text>
              )}
              <Group justify="flex-end">
                <Button component="a" href={url} download={attachment.filename} variant="light">
                  Download attachment
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
