import {
  KafkaSecurityOptions,
  loadKafkaSecurityOptions,
  loadServiceConfig,
  ServiceConfig,
} from '@ticket-booking/config';

export type NotificationConfig = ServiceConfig & {
  databaseUrl: string;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaGroupId: string;
  kafkaSecurity: KafkaSecurityOptions;
  emailProviderBaseUrl: string;
  emailProviderApiKey: string;
};

export const NOTIFICATION_CONFIG = Symbol('NOTIFICATION_CONFIG');

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadNotificationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): NotificationConfig {
  const brokers = required(environment, 'KAFKA_BROKERS')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  if (brokers.length === 0) {
    throw new Error('KAFKA_BROKERS must contain at least one broker');
  }
  return {
    ...loadServiceConfig(environment),
    databaseUrl: required(environment, 'DATABASE_URL'),
    kafkaBrokers: brokers,
    kafkaClientId: required(environment, 'KAFKA_CLIENT_ID'),
    kafkaGroupId: required(environment, 'KAFKA_GROUP_ID'),
    kafkaSecurity: loadKafkaSecurityOptions(environment),
    emailProviderBaseUrl: required(environment, 'EMAIL_PROVIDER_BASE_URL'),
    emailProviderApiKey: required(environment, 'EMAIL_PROVIDER_API_KEY'),
  };
}

