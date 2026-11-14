import { apiRequest } from '@/lib/api-client/client';
import {
  clearStoredSession,
  readSession,
  writeSession,
  type AuthSession,
} from './auth-boundary';

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: Omit<AuthSession['user'], 'mfaCompleted'> & { mfaCompleted?: boolean };
};

function readMfaClaim(accessToken: string): boolean {
  try {
    const payload = accessToken.split('.')[1];
    return Boolean(JSON.parse(atob(payload)).mfa_completed);
  } catch {
    return false;
  }
}

function toSession(response: TokenResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + response.expiresIn * 1000,
    user: {
      ...response.user,
      mfaCompleted: response.user.mfaCompleted ?? readMfaClaim(response.accessToken),
    },
  };
}

export async function login(
  email: string,
  password: string,
  mfaCode?: string,
): Promise<AuthSession> {
  const response = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      ...(mfaCode ? { mfaCode } : {}),
    }),
  });
  const session = toSession(response);
  writeSession(session);
  return session;
}

export async function refreshSession(): Promise<AuthSession | null> {
  const current = readSession();
  if (!current) return null;
  const response = await apiRequest<TokenResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  const session = toSession(response);
  writeSession(session);
  return session;
}

export async function logout(): Promise<void> {
  const current = readSession();
  try {
    if (current) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
    }
  } finally {
    clearStoredSession();
  }
}

export async function register(email: string, password: string) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyEmail(token: string) {
  return apiRequest('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function requestPasswordReset(email: string) {
  return apiRequest('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, password: string) {
  return apiRequest('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}
