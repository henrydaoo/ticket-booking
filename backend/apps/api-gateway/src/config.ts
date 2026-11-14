import { loadServiceConfig, ServiceConfig } from '@ticket-booking/config';

export type GatewayConfig = ServiceConfig & {
  identityServiceUrl: string;
  identityJwksUrl: string;
  catalogServiceUrl: string;
  bookingServiceUrl: string;
  corsOrigins: string[];
  jwtIssuer: string;
  jwtAudience: string;
  jwksCacheTtlSeconds: number;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
};

export const GATEWAY_CONFIG = Symbol('GATEWAY_CONFIG');

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

function listEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string,
  defaultValue: string,
): string[] {
  const value = environment[name]?.trim() || defaultValue;
  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);

  if (entries.length === 0) {
    throw new Error(`${name} must contain at least one origin`);
  }

  for (const origin of entries) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/') {
      throw new Error(`${name} contains an invalid origin: ${origin}`);
    }
  }

  return entries;
}

export function loadGatewayConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GatewayConfig {
  return {
    ...loadServiceConfig(environment),
    identityServiceUrl: requiredEnvironment(environment, 'IDENTITY_SERVICE_URL').replace(
      /\/+$/,
      '',
    ),
    identityJwksUrl: requiredEnvironment(environment, 'IDENTITY_JWKS_URL'),
    catalogServiceUrl: requiredEnvironment(environment, 'CATALOG_SERVICE_URL').replace(
      /\/+$/,
      '',
    ),
    bookingServiceUrl: requiredEnvironment(environment, 'BOOKING_SERVICE_URL').replace(
      /\/+$/,
      '',
    ),
    corsOrigins: listEnvironment(
      environment,
      'CORS_ORIGINS',
      'http://localhost:3007,http://127.0.0.1:3007',
    ),
    jwtIssuer: requiredEnvironment(environment, 'JWT_ISSUER'),
    jwtAudience: requiredEnvironment(environment, 'JWT_AUDIENCE'),
    jwksCacheTtlSeconds: positiveIntegerEnvironment(environment, 'JWKS_CACHE_TTL_SECONDS', 300),
    rateLimitWindowSeconds: positiveIntegerEnvironment(
      environment,
      'AUTH_RATE_LIMIT_WINDOW_SECONDS',
      60,
    ),
    rateLimitMaxRequests: positiveIntegerEnvironment(
      environment,
      'AUTH_RATE_LIMIT_MAX_REQUESTS',
      30,
    ),
  };
}

