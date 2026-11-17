import {
  KafkaSecurityOptions,
  loadKafkaSecurityOptions,
  loadServiceConfig,
  ServiceConfig,
} from '@ticket-booking/config';

export type TicketConfig = ServiceConfig & {
  databaseUrl: string;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaGroupId: string;
  kafkaSecurity: KafkaSecurityOptions;
  qrTokenEncryptionKey: Buffer;
};

export const TICKET_CONFIG = Symbol('TICKET_CONFIG');

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadTicketConfig(environment: NodeJS.ProcessEnv = process.env): TicketConfig {
  const brokers = required(environment, 'KAFKA_BROKERS')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  if (brokers.length === 0) {
    throw new Error('KAFKA_BROKERS must contain at least one broker');
  }
  const encodedQrTokenEncryptionKey = required(environment, 'TICKET_QR_TOKEN_ENCRYPTION_KEY');
  const qrTokenEncryptionKey = Buffer.from(encodedQrTokenEncryptionKey, 'base64');
  if (
    qrTokenEncryptionKey.length !== 32 ||
    qrTokenEncryptionKey.toString('base64') !== encodedQrTokenEncryptionKey
  ) {
    throw new Error('TICKET_QR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  return {
    ...loadServiceConfig(environment),
    databaseUrl: required(environment, 'DATABASE_URL'),
    kafkaBrokers: brokers,
    kafkaClientId: required(environment, 'KAFKA_CLIENT_ID'),
    kafkaGroupId: required(environment, 'KAFKA_GROUP_ID'),
    kafkaSecurity: loadKafkaSecurityOptions(environment),
    qrTokenEncryptionKey,
  };
}

