import { accessTokenStore } from '../auth/accessTokenStore';
import { ApiError } from './errors';

const BASE_URL = import.meta.env.VITE_API_URL as string;

// Single-flight refresh promise to prevent token stampede on concurrent 401s
let refreshInFlight: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'Token refresh failed');
  }
  // Inline parse — avoids circular import with queries.ts which imports apiRequest
  const body = (await res.json()) as { accessToken?: unknown };
  if (typeof body.accessToken !== 'string') {
    throw new ApiError(0, 'Invalid refresh response shape');
  }
  return body.accessToken;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = accessTokenStore.get();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
    // Allow caller to override headers
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  // 401 on non-auth endpoints → attempt single-flight refresh then retry once
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (refreshInFlight === null) {
      refreshInFlight = doRefresh().finally(() => {
        refreshInFlight = null;
      });
    }

    let newToken: string;
    try {
      newToken = await refreshInFlight;
    } catch (err) {
      accessTokenStore.set(null);
      throw err;
    }

    accessTokenStore.set(newToken);

    // Retry original request with the new token
    const retryHeaders: Record<string, string> = {
      ...headers,
      Authorization: `Bearer ${newToken}`,
    };
    const retryRes = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: retryHeaders,
    });

    if (!retryRes.ok) {
      throw new ApiError(retryRes.status, await retryRes.text());
    }

    return retryRes.json() as Promise<T>;
  }

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }

  return res.json() as Promise<T>;
}
