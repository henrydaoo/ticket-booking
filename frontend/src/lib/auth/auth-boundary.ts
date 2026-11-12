export type AuthSession = {
  accessToken: string;
  expiresAt: number;
};

export type AuthProvider = {
  getSession(): Promise<AuthSession | null>;
  clearSession(): Promise<void>;
};

export const authIntegrationBoundary = {
  description:
    'Identity Service tokens are acquired through the API Gateway; token storage and refresh are deferred.',
};
