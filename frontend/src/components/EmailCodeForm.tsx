import { useState, type FormEvent } from 'react';
import { Button, Stack, Text, TextInput } from '@mantine/core';
import type { EmailCodeChallenge } from '@portlog/schemas';

type Props = {
  challenge: EmailCodeChallenge;
  loading: boolean;
  error: string | null;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
};

export function EmailCodeForm({ challenge, loading, error, onVerify, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const valid = /^\d{6}$/.test(code);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (valid) await onVerify(code);
  }
  return (
    <form onSubmit={(e) => void submit(e)}>
      <Stack gap="md">
        <Text size="sm">
          Enter the code sent to {challenge.maskedEmail}. It expires in 10 minutes.
        </Text>
        <TextInput
          label="Email verification code"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          error={submitted && !valid ? 'Enter the six-digit code.' : undefined}
        />
        {error && (
          <Text role="alert" c="red" size="sm">
            {error}
          </Text>
        )}
        <Button type="submit" loading={loading}>
          Verify code
        </Button>
        <Button variant="subtle" disabled={loading} onClick={onCancel}>
          Start again
        </Button>
      </Stack>
    </form>
  );
}
