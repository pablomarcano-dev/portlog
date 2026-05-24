import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CurrentUserSchema, LoginResponseSchema, RefreshResponseSchema } from '@portlog/schemas';
import type { CurrentUser, LoginRequest } from '@portlog/schemas';
import { apiRequest } from '../api/client';
import { accessTokenStore } from './accessTokenStore';

// Re-export for consumers that need the type
export type { CurrentUser };

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const raw = await apiRequest<unknown>('/auth/me');
      return CurrentUserSchema.parse(raw);
    },
    staleTime: 5 * 60_000, // treat the current user as fresh for 5 min — avoids stampede on mount
    retry: false, // don't retry on 401; the silent-refresh in main.tsx handles that
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const raw = await apiRequest<unknown>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return LoginResponseSchema.parse(raw);
    },
    onSuccess: (data) => {
      accessTokenStore.set(data.accessToken);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest<unknown>('/auth/logout', { method: 'POST' });
    },
    onSuccess: () => {
      accessTokenStore.set(null);
      queryClient.clear();
    },
  });
}

// Exported for use in main.tsx boot-time silent refresh
export async function attemptSilentRefresh(): Promise<void> {
  try {
    const raw = await apiRequest<unknown>('/auth/refresh', { method: 'POST' });
    const data = RefreshResponseSchema.parse(raw);
    accessTokenStore.set(data.accessToken);
  } catch {
    // No valid session — normal on first visit or after logout
  }
}
