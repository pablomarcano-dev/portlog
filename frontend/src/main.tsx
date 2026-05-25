import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { attemptSilentRefresh } from './lib/auth/queries';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch every time the user alt-tabs or opens dev tools
      refetchOnWindowFocus: false,
      // 3 retries is the default but make it explicit; Zod parse errors are
      // non-retryable so cap at 1 for faster failure feedback
      retry: (failureCount, error) => {
        // Don't retry Zod / schema parse errors — they won't self-heal
        if (error instanceof Error && error.name === 'ZodError') return false;
        return failureCount < 2;
      },
    },
  },
});

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

// Attempt to restore session from httpOnly refresh-token cookie before first render.
// If it succeeds the access token is stored in-memory and all subsequent queries
// will be authenticated. If it fails (no cookie / expired) we render unauthenticated.
attemptSilentRefresh().finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <RouterProvider router={router} />
        </MantineProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
