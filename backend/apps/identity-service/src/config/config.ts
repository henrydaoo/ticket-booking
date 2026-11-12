import { loadServiceConfig, ServiceConfig } from '@ticket-booking/config';

export type IdentityConfig = ServiceConfig & {
  databaseUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtPrivateKeyPath: string;
  jwtPublicKeyPath: string;
  emailLinkBaseUrl: string;
  emailDeliveryMode: 'local';
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
};

export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG');

function requiredEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function positiveIntegerEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
): number {
  const rawValue = environment[name]?.trim();
  const value = rawValue ? Number(rawValue) : defaultValue;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function emailLinkBaseUrl(environment: NodeJS.ProcessEnv): string {
  const value = environment.EMAIL_LINK_BASE_URL?.trim();
  if (value) {
    return value;
  }
  if (environment.NODE_ENV === 'production') {
    throw new Error('Missing required environment variable: EMAIL_LINK_BASE_URL');
  }
  return 'http://localhost:3000';
}

export function loadIdentityConfig(
  environment: NodeJS.ProcessEnv = process.env,
): IdentityConfig {
  return {
    ...loadServiceConfig(environment),
    databaseUrl: requiredEnvironment(environment, 'DATABASE_URL'),
    jwtIssuer: requiredEnvironment(environment, 'JWT_ISSUER'),
    jwtAudience: requiredEnvironment(environment, 'JWT_AUDIENCE'),
    jwtPrivateKeyPath: requiredEnvironment(environment, 'JWT_PRIVATE_KEY_PATH'),
    jwtPublicKeyPath: requiredEnvironment(environment, 'JWT_PUBLIC_KEY_PATH'),
    emailLinkBaseUrl: emailLinkBaseUrl(environment),
    emailDeliveryMode: 'local',
    accessTokenTtlSeconds: positiveIntegerEnvironment(environment, 'ACCESS_TOKEN_TTL_SECONDS', 900),
    refreshTokenTtlSeconds: positiveIntegerEnvironment(
      environment,
      'REFRESH_TOKEN_TTL_SECONDS',
      2_592_000,
    ),
  };
}

