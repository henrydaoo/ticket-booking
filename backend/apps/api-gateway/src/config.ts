import { loadServiceConfig, ServiceConfig } from '@ticket-booking/config';

export type GatewayConfig = ServiceConfig & {
  identityServiceUrl: string;
  identityJwksUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
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
    jwtIssuer: requiredEnvironment(environment, 'JWT_ISSUER'),
    jwtAudience: requiredEnvironment(environment, 'JWT_AUDIENCE'),
  };
}

