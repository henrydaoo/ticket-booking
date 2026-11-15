import { loadServiceConfig, ServiceConfig } from '@ticket-booking/config';

export type PaymentConfig = ServiceConfig & {
  databaseUrl: string;
  bookingServiceUrl: string;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaGroupId: string;
  vnpayPaymentUrl: string;
  vnpayApiUrl: string;
  vnpayTmnCode: string;
  vnpayHashSecret: string;
  vnpayReturnUrl: string;
  vnpayIpnUrl: string;
  paymentProcessingDeadlineSeconds: number;
  paymentReconciliationIntervalSeconds: number;
};

export const PAYMENT_CONFIG = Symbol('PAYMENT_CONFIG');

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function positiveInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = environment[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
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
    bookingServiceUrl: required(environment, 'BOOKING_SERVICE_URL').replace(/\/+$/, ''),
    kafkaBrokers: brokers,
    kafkaClientId: required(environment, 'KAFKA_CLIENT_ID'),
    kafkaGroupId: required(environment, 'KAFKA_GROUP_ID'),
    vnpayPaymentUrl: required(environment, 'VNPAY_PAYMENT_URL'),
    vnpayApiUrl: required(environment, 'VNPAY_API_URL'),
    vnpayTmnCode: required(environment, 'VNPAY_TMN_CODE'),
    vnpayHashSecret: required(environment, 'VNPAY_HASH_SECRET'),
    vnpayReturnUrl: required(environment, 'VNPAY_RETURN_URL'),
    vnpayIpnUrl: required(environment, 'VNPAY_IPN_URL'),
    paymentProcessingDeadlineSeconds: positiveInteger(
      environment,
      'PAYMENT_PROCESSING_DEADLINE_SECONDS',
      300,
    ),
    paymentReconciliationIntervalSeconds: positiveInteger(
      environment,
      'PAYMENT_RECONCILIATION_INTERVAL_SECONDS',
      30,
    ),
  };
}

