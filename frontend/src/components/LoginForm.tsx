import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '../lib/zodResolver';
import { TextInput, PasswordInput, Button, Text, Stack } from '@mantine/core';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { LoginRequestSchema } from '@portlog/schemas';
import type { LoginRequest, EmailCodeChallenge } from '@portlog/schemas';
import { EmailCodeForm } from './EmailCodeForm';
import { useLogin, useVerifyLoginCode } from '../lib/auth/queries';
import { ApiError } from '../lib/api/errors';

export function LoginForm() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/login' });
  const login = useLogin();
  const verify = useVerifyLoginCode();
  const [challenge, setChallenge] = useState<EmailCodeChallenge | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
  });

  async function onSubmit(data: LoginRequest) {
    setAuthError(null);
    try {
      const outcome = await login.mutateAsync(data);
      if ('twoFactorRequired' in outcome) {
        reset();
        setChallenge(outcome);
        return;
      }
      await enterApp();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError('Invalid username, email or password.');
      } else if (err instanceof ApiError && err.status === 429) {
        setAuthError('Too many attempts or codes requested. Please try again later.');
      } else if (err instanceof ApiError && err.status === 503) {
        setAuthError('The verification email could not be sent. Please try again later.');
      } else {
        setAuthError('An unexpected error occurred. Please try again.');
      }
    }
  }

  async function enterApp() {
    const redirectTo =
      typeof search === 'object' &&
      search !== null &&
      'redirect' in search &&
      typeof (search as { redirect?: unknown }).redirect === 'string'
        ? (search as { redirect: string }).redirect
        : '/';
    await navigate({ to: redirectTo });
  }

  if (challenge)
    return (
      <EmailCodeForm
        challenge={challenge}
        loading={verify.isPending}
        error={authError}
        onCancel={() => {
          setChallenge(null);
          setAuthError(null);
        }}
        onVerify={async (code) => {
          setAuthError(null);
          try {
            await verify.mutateAsync({ challengeId: challenge.challengeId, code });
            await enterApp();
          } catch (err) {
            setAuthError(
              err instanceof ApiError && err.status === 429
                ? 'Too many attempts. Please try again later.'
                : 'Invalid or expired code. Check the email or start again.',
            );
          }
        }}
      />
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <TextInput
          label="Username or email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {authError !== null && (
          <Text c="red" size="sm">
            {authError}
          </Text>
        )}
        <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
          Sign in
        </Button>
      </Stack>
    </form>
  );
}
