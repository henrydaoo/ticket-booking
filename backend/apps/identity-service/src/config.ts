import { loadServiceConfig, ServiceConfig } from '@ticket-booking/config';

export type IdentityConfig = ServiceConfig & {
  databaseUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtPrivateKeyPath: string;
  jwtPublicKeyPath: string;
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
  };
}

