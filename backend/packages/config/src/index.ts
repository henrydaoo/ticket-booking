export type NodeEnvironment = 'development' | 'test' | 'production';

export type ServiceConfig = {
  serviceName: string;
  port: number;
  nodeEnvironment: NodeEnvironment;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
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

