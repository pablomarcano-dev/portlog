import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Checkbox,
  TextInput,
  Divider,
  Loader,
  Box,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useNominationEta } from '../api/useNominationEta';
import { useNominationEtaSave } from '../api/useNominationEtaSave';
import { EmailComposeDrawer } from './EmailComposeDrawer';
import type { SubDocType } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EtaAnswerModalProps {
  opened: boolean;
  onClose: () => void;
  nominationId: string;
  pedrId: string;
  vesselName?: string;
}

type EtaSendType = 'ETA_REQUEST' | 'ETA_TERMINAL' | 'ETA_REPLY';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EtaAnswerModal({
  opened,
  onClose,
  nominationId,
  pedrId,
  vesselName = '',
}: EtaAnswerModalProps) {
  const etaQuery = useNominationEta(nominationId, opened);
  const etaSave = useNominationEtaSave(nominationId);

  const [msgEta, setMsgEta] = useState<Date | null>(null);
  const [etaNotify, setEtaNotify] = useState<Date | null>(null);
  const [etaNotifyOn, setEtaNotifyOn] = useState(false);
  const [etpob, setEtpob] = useState<Date | null>(null);
  const [etpobOn, setEtpobOn] = useState(false);
  const [etb, setEtb] = useState<Date | null>(null);
  const [etbOn, setEtbOn] = useState(false);
  const [refMessage, setRefMessage] = useState('');

  const [activeSend, setActiveSend] = useState<EtaSendType | null>(null);

  // Sync remote data into local state on load
  useEffect(() => {
    if (!etaQuery.data) return;
    const r = etaQuery.data;
    setMsgEta(r.msgEta ? new Date(r.msgEta) : null);
    setEtaNotify(r.etaNotify ? new Date(r.etaNotify) : null);
    setEtaNotifyOn(r.etaNotifyOn);
    setEtpob(r.etpob ? new Date(r.etpob) : null);
    setEtpobOn(r.etpobOn);
    setEtb(r.etb ? new Date(r.etb) : null);
    setEtbOn(r.etbOn);
    setRefMessage(r.refMessage ?? '');
  }, [etaQuery.data]);

  function buildPayload() {
    return {
      msgEta: msgEta?.toISOString() ?? null,
      etaNotify: etaNotify?.toISOString() ?? null,
      etaNotifyOn,
      etpob: etpob?.toISOString() ?? null,
      etpobOn,
      etb: etb?.toISOString() ?? null,
      etbOn,
      refMessage: refMessage || null,
    };
  }

  function handleSave() {
    etaSave.mutate(buildPayload());
  }

  function handleSendClick(type: EtaSendType) {
    // Save first, then open compose
    etaSave.mutate(buildPayload(), {
      onSuccess: () => setActiveSend(type),
    });
  }

  function handleClose() {
    setActiveSend(null);
    onClose();
  }

  const subjectFor: Record<EtaSendType, string> = {
    ETA_REQUEST: `${vesselName} - ETA Request`,
    ETA_TERMINAL: `${vesselName} - ETA Forwarded to Terminal`,
    ETA_REPLY: `${vesselName} - 96 Hours ETA Notice`,
  };

  return (
    <>
      <Modal
        opened={opened && !activeSend}
        onClose={handleClose}
        title={
          <Text fw={600} size="sm">
            Answer ETA — {vesselName}
          </Text>
        }
        padding="lg"
        size="70vw"
        styles={{
          content: {
            resize: 'both',
            overflow: 'auto',
            width: '100%',
            minWidth: 400,
          },
        }}
      >
        {etaQuery.isLoading ? (
          <Box ta="center" py="xl">
            <Loader size="sm" />
          </Box>
        ) : (
          <Stack gap="sm">
            {/* Msg. ETA */}
            <DateTimePicker
              label="Msg. ETA"
              description="When master's ETA message was received"
              placeholder="Select date and time"
              value={msgEta}
              onChange={setMsgEta}
              clearable
            />

            <Divider />

            {/* ETA Notify */}
            <Group align="flex-end" gap="xs">
              <Checkbox
                checked={etaNotifyOn}
                onChange={(e) => setEtaNotifyOn(e.currentTarget.checked)}
                mt={28}
              />
              <DateTimePicker
                label="ETA Notify"
                description="ETA reported by master"
                placeholder="Select date and time"
                value={etaNotify}
                onChange={setEtaNotify}
                clearable
                style={{ flex: 1 }}
              />
            </Group>

            {/* ETPOB */}
            <Group align="flex-end" gap="xs">
              <Checkbox
                checked={etpobOn}
                onChange={(e) => setEtpobOn(e.currentTarget.checked)}
                mt={28}
              />
              <DateTimePicker
                label="ETPOB"
                description="Estimated Time Pilot On Board"
                placeholder="Select date and time"
                value={etpob}
                onChange={setEtpob}
                clearable
                style={{ flex: 1 }}
              />
            </Group>

            {/* ETB */}
            <Group align="flex-end" gap="xs">
              <Checkbox
                checked={etbOn}
                onChange={(e) => setEtbOn(e.currentTarget.checked)}
                mt={28}
              />
              <DateTimePicker
                label="ETB"
                description="Estimated Time of Berthing"
                placeholder="Select date and time"
                value={etb}
                onChange={setEtb}
                clearable
                style={{ flex: 1 }}
              />
            </Group>

            <Divider />

            {/* Ref message */}
            <TextInput
              label="Ref ETA / ETB Message"
              placeholder="e.g. Master's message reference"
              value={refMessage}
              onChange={(e) => setRefMessage(e.currentTarget.value)}
            />

            {/* Actions */}
            <Group justify="space-between" mt="sm">
              <Group gap="xs">
                <Button
                  variant="light"
                  size="sm"
                  loading={etaSave.isPending && !activeSend}
                  onClick={() => handleSendClick('ETA_REQUEST')}
                >
                  ETA Request
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  loading={etaSave.isPending && !activeSend}
                  onClick={() => handleSendClick('ETA_TERMINAL')}
                >
                  Send to Terminal
                </Button>
                <Button
                  variant="light"
                  size="sm"
                  loading={etaSave.isPending && !activeSend}
                  onClick={() => handleSendClick('ETA_REPLY')}
                >
                  Reply to Master
                </Button>
              </Group>
              <Group gap="xs">
                <Button variant="default" onClick={handleClose} disabled={etaSave.isPending}>
                  Close
                </Button>
                <Button
                  variant="default"
                  loading={etaSave.isPending && !activeSend}
                  onClick={handleSave}
                >
                  Save
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Compose drawer opens after save, for whichever send button was clicked */}
      {activeSend && (
        <EmailComposeDrawer
          opened={!!activeSend}
          onClose={() => setActiveSend(null)}
          pedrId={pedrId}
          nominationId={nominationId}
          subDocType={activeSend as SubDocType}
          defaultSubject={subjectFor[activeSend]}
        />
      )}
    </>
  );
}
