import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextInput, PasswordInput, Button, Text, Stack } from '@mantine/core';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { LoginRequestSchema } from '@portlog/schemas';
import type { LoginRequest } from '@portlog/schemas';
import { useLogin } from '../lib/auth/queries';
import { ApiError } from '../lib/api/errors';

export function LoginForm() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/login' });
  const login = useLogin();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
  });

  async function onSubmit(data: LoginRequest) {
    setAuthError(null);
    try {
      await login.mutateAsync(data);
      const redirectTo =
        typeof search === 'object' &&
        search !== null &&
        'redirect' in search &&
        typeof (search as { redirect?: unknown }).redirect === 'string'
          ? (search as { redirect: string }).redirect
          : '/';
      await navigate({ to: redirectTo });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError('Invalid email or password.');
      } else {
        setAuthError('An unexpected error occurred. Please try again.');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
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
