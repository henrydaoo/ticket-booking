const assert = require('node:assert/strict');
const test = require('node:test');

test('payment configuration validates provider and Kafka boundaries', () => {
  const { loadPaymentConfig } = require('../dist/config.js');
  const config = loadPaymentConfig({
    SERVICE_NAME: 'payment-service',
    PORT: '3004',
    DATABASE_URL: 'postgresql://payment',
    BOOKING_SERVICE_URL: 'http://localhost:3003',
    KAFKA_BROKERS: 'localhost:9092',
    KAFKA_CLIENT_ID: 'payment-service',
    KAFKA_GROUP_ID: 'payment-foundation',
    VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_TMN_CODE: 'tmn-code',
    VNPAY_HASH_SECRET: 'hash-secret',
    VNPAY_RETURN_URL: 'https://frontend.example.com/payment/return',
    VNPAY_IPN_URL: 'https://api.example.com/payment/webhooks/vnpay',
  });
  assert.equal(config.vnpayPaymentUrl, 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
  assert.deepEqual(config.kafkaBrokers, ['localhost:9092']);
  assert.equal(config.paymentProcessingDeadlineSeconds, 300);
  assert.equal(config.paymentReconciliationIntervalSeconds, 30);
});

