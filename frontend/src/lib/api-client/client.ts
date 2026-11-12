import { getApiBaseUrl } from '@/lib/config/runtime';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export type ApiRequestOptions = RequestInit & {
  correlationId?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { correlationId, headers, ...requestInit } = options;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...requestInit,
    headers: {
      accept: 'application/json',
      ...(requestInit.body ? { 'content-type': 'application/json' } : {}),
      ...(correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
