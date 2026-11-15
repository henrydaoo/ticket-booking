import { readFileSync } from 'node:fs';

export type NodeEnvironment = 'development' | 'test' | 'production';

export type ServiceConfig = {
  serviceName: string;
  port: number;
  nodeEnvironment: NodeEnvironment;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
};

export type KafkaSecurityOptions = {
  ssl?: true | { ca: string[] };
  sasl?:
    | { mechanism: 'plain'; username: string; password: string }
    | { mechanism: 'scram-sha-256'; username: string; password: string }
    | { mechanism: 'scram-sha-512'; username: string; password: string };
};

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

const LOG_LEVELS = new Set<ServiceConfig['logLevel']>([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
]);

function optionalValue(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = environment[name]?.trim();
  return value || undefined;
}

function parseBoolean(environment: NodeJS.ProcessEnv, name: string, defaultValue: boolean): boolean {
  const rawValue = optionalValue(environment, name);
  if (!rawValue) return defaultValue;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new ConfigurationError(`${name} must be true or false`);
}

export function loadKafkaSecurityOptions(
  environment: NodeJS.ProcessEnv = process.env,
): KafkaSecurityOptions {
  const username = optionalValue(environment, 'KAFKA_USERNAME');
  const password = optionalValue(environment, 'KAFKA_PASSWORD');

  if (!username && !password) {
    return {};
  }
  if (!username || !password) {
    throw new ConfigurationError(
      'KAFKA_USERNAME and KAFKA_PASSWORD must be provided together',
    );
  }

  if (!parseBoolean(environment, 'KAFKA_SSL', true)) {
    throw new ConfigurationError('KAFKA_SSL must be true when Kafka SASL is configured');
  }

  const mechanism = optionalValue(environment, 'KAFKA_SASL_MECHANISM')?.toLowerCase();
  if (
    mechanism !== 'plain' &&
    mechanism !== 'scram-sha-256' &&
    mechanism !== 'scram-sha-512'
  ) {
    throw new ConfigurationError(
      'KAFKA_SASL_MECHANISM must be plain, scram-sha-256, or scram-sha-512',
    );
  }

  const caPath = optionalValue(environment, 'KAFKA_CA_CERT_PATH');
  const ssl = caPath
    ? { ca: [readFileSync(caPath, 'utf8')] }
    : true;

  const sasl =
    mechanism === 'plain'
      ? { mechanism: 'plain' as const, username, password }
      : mechanism === 'scram-sha-256'
        ? { mechanism: 'scram-sha-256' as const, username, password }
        : { mechanism: 'scram-sha-512' as const, username, password };

  return { ssl, sasl };
}

function requiredValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(value: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function loadServiceConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServiceConfig {
  const nodeEnvironment = (environment.NODE_ENV?.trim() || 'development') as NodeEnvironment;

  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    throw new ConfigurationError(
      'NODE_ENV must be one of: development, test, production',
    );
  }

  const logLevel = (environment.LOG_LEVEL?.trim() || 'info') as ServiceConfig['logLevel'];

  if (!LOG_LEVELS.has(logLevel)) {
    throw new ConfigurationError(
      'LOG_LEVEL must be one of: fatal, error, warn, info, debug, trace',
    );
  }

  return {
    serviceName: requiredValue(environment, 'SERVICE_NAME'),
    port: parsePort(requiredValue(environment, 'PORT')),
    nodeEnvironment,
    logLevel,
  };
}

