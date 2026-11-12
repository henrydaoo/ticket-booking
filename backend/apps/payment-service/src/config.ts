import { loadServiceConfig, ServiceConfig } from '@ticket-booking/config';

export type PaymentConfig = ServiceConfig & {
  databaseUrl: string;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaGroupId: string;
  providerBaseUrl: string;
  providerApiKey: string;
};

export const PAYMENT_CONFIG = Symbol('PAYMENT_CONFIG');

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadPaymentConfig(environment: NodeJS.ProcessEnv = process.env): PaymentConfig {
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
    providerBaseUrl: required(environment, 'PAYMENT_PROVIDER_BASE_URL'),
    providerApiKey: required(environment, 'PAYMENT_PROVIDER_API_KEY'),
  };
}

