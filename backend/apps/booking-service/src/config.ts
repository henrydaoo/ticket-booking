import { loadServiceConfig, ServiceConfig } from '@ticket-booking/config';

export type BookingConfig = ServiceConfig & {
  databaseUrl: string;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaGroupId: string;
};

export const BOOKING_CONFIG = Symbol('BOOKING_CONFIG');

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

export function loadBookingConfig(
  environment: NodeJS.ProcessEnv = process.env,
): BookingConfig {
  const kafkaBrokers = requiredEnvironment(environment, 'KAFKA_BROKERS')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (kafkaBrokers.length === 0) {
    throw new Error('KAFKA_BROKERS must contain at least one broker');
  }

  return {
    ...loadServiceConfig(environment),
    databaseUrl: requiredEnvironment(environment, 'DATABASE_URL'),
    kafkaBrokers,
    kafkaClientId: requiredEnvironment(environment, 'KAFKA_CLIENT_ID'),
    kafkaGroupId: requiredEnvironment(environment, 'KAFKA_GROUP_ID'),
  };
}

