import { getApiBaseUrl } from '@/lib/config/runtime';
import { readSession } from '@/lib/auth/auth-boundary';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export type ApiRequestOptions = RequestInit & {
  correlationId?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function userFacingApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 401) return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (error.status === 404) return 'Không tìm thấy dữ liệu yêu cầu.';
  if (error.status >= 500) return 'Dịch vụ đang tạm thời không khả dụng. Vui lòng thử lại sau.';
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { correlationId, headers, ...requestInit } = options;
  const session = readSession();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...requestInit,
    headers: {
      accept: 'application/json',
      ...(requestInit.body ? { 'content-type': 'application/json' } : {}),
      ...(correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {}),
      ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = body.error?.code;
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Keep the generic safe message when the dependency does not return JSON.
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
