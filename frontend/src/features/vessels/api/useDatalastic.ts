import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';

/**
 * Generic hook that proxies any whitelisted Datalastic endpoint through the
 * backend proxy (GET /datalastic/:endpoint).
 *
 * staleTime matches the server-side LRU TTL (5 min) so we don't re-fetch data
 * that is still fresh in the server cache.
 */
export function useDatalastic<T>(
  endpoint: string,
  params: Record<string, string>,
  options?: { enabled?: boolean },
): { data: T | undefined; isLoading: boolean; isError: boolean; error: unknown } {
  const searchParams = new URLSearchParams(params).toString();
  const url = `/datalastic/${endpoint}${searchParams ? `?${searchParams}` : ''}`;

  const query = useQuery<T>({
    queryKey: ['datalastic', endpoint, params],
    queryFn: () => apiRequest<T>(url),
    staleTime: 5 * 60 * 1_000,
    enabled: options?.enabled ?? true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
