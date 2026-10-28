import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, TextInput, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { ContactCreateSchema } from '@portlog/schemas';
import { contactsApi } from '../../../lib/api/master-data/contacts';
import { EmailChipsInput } from '../../../components/master-data/EmailChipsInput';
export function CaptainContactModal({
  opened,
  onClose,
  contact,
  initialName,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  contact?: { id: string; name: string; emails: string[] } | null;
  initialName: string;
  onSaved: (contact: { id: string; name: string; emails: string[] }) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (opened) {
      setName(contact?.name ?? initialName);
      setEmails(contact?.emails ?? []);
      setError('');
    }
  }, [opened, contact?.id]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      const input = ContactCreateSchema.parse({ name, emails });
      const saved = contact
        ? await contactsApi.update(contact.id, { emails: input.emails })
        : await contactsApi.create(input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contacts'] }),
        qc.invalidateQueries({ queryKey: ['entity-picker'] }),
        qc.invalidateQueries({ queryKey: ['nomination'] }),
      ]);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save captain contact');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      opened={opened}
      onClose={() => !busy && onClose()}
      title={contact ? 'Captain contact emails' : 'New captain contact'}
    >
      <Stack>
        <TextInput
          label="Captain name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          disabled={!!contact || busy}
          required
        />
        <EmailChipsInput label="Captain email addresses" value={emails} onChange={setEmails} />
        <Text size="sm" c="dimmed">
          {contact
            ? 'Updates this contact in the shared directory. Other nominations linked to this contact use the same addresses.'
            : 'Creates a contact and selects it on this nomination. Save the nomination to retain the link.'}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button type="button" variant="default" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={busy} onClick={() => void save()}>
            Save captain contact
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
