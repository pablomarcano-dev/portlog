import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { EmailCodeChallengeSchema, type EmailCodeChallenge } from '@portlog/schemas';
import { useCurrentUser } from '../../lib/auth/queries';
import { apiRequest } from '../../lib/api/client';
import { accessTokenStore } from '../../lib/auth/accessTokenStore';
import { EmailCodeForm } from '../../components/EmailCodeForm';

export const Route = createFileRoute('/_protected/security')({ component: SecurityPage });

function SecurityPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<EmailCodeChallenge | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setLoading(true);
    setError(null);
    try {
      const next = !user?.twoFactorEnabled;
      const raw = await apiRequest<unknown>('/auth/two-factor/change', {
        method: 'POST',
        body: JSON.stringify({ password, enabled: next }),
      });
      setEnabled(next);
      setChallenge(EmailCodeChallengeSchema.parse(raw));
      setPassword('');
    } catch {
      setError('Unable to send a code. Check your password and try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function confirm(code: string) {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/auth/two-factor/confirm', {
        method: 'POST',
        body: JSON.stringify({ challengeId: challenge.challengeId, code, enabled }),
      });
      accessTokenStore.set(null);
      queryClient.clear();
      await navigate({ to: '/login' });
    } catch {
      setError('Invalid or expired code. Check the email or start again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="sm" py="xl">
      <Paper withBorder p="xl">
        <Stack>
          <Title order={2}>Account security</Title>
          <Badge color={user?.twoFactorEnabled ? 'green' : 'gray'}>
            Email two-factor authentication: {user?.twoFactorEnabled ? 'enabled' : 'disabled'}
          </Badge>
          <Text size="sm">
            When enabled, sign-in requires your password and a code sent to your account email. Both
            enabling and disabling require your password and an email code. You will sign in again
            after a change.
          </Text>
          <Alert color="blue">
            Use an email account you control. Anyone with access to a shared mailbox can read its
            verification codes.
          </Alert>
          {challenge ? (
            <EmailCodeForm
              challenge={challenge}
              loading={loading}
              error={error}
              onVerify={confirm}
              onCancel={() => {
                setChallenge(null);
                setError(null);
              }}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void requestCode();
              }}
            >
              <Stack>
                <PasswordInput
                  label="Current password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  required
                  minLength={8}
                />
                {error && (
                  <Text role="alert" c="red">
                    {error}
                  </Text>
                )}
                <Button type="submit" loading={loading} disabled={!user}>
                  {user?.twoFactorEnabled ? 'Disable' : 'Enable'} email two-factor authentication
                </Button>
              </Stack>
            </form>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
