const assert = require('node:assert/strict');
const test = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { Pool } = require('pg');
const config = require('../dist/config.js');
const { HealthController } = require('../dist/health.controller.js');
const { CatalogOutboxPublisher } = require('../dist/modules/showtimes/outbox/catalog-outbox.publisher.js');
const {
  requireCatalogManager,
  requirePlatformAdmin,
} = require('../dist/common/principal.js');

test('application module starts with health and feature dependencies', async (t) => {
  t.mock.method(config, 'loadCatalogConfig', () => ({
    serviceName: 'catalog-test',
    databaseUrl: 'postgresql://localhost/catalog_test',
    kafkaBrokers: ['localhost:9092'],
    kafkaClientId: 'catalog-test',
  }));
  t.mock.method(CatalogOutboxPublisher.prototype, 'onModuleInit', () => {});

  const { AppModule } = require('../dist/app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: false,
    logger: false,
  });
  const pool = app.get(Pool);
  try {
    assert.deepEqual(app.get(HealthController).health(), {
      status: 'ok',
      service: 'catalog-test',
    });
  } finally {
    await app.close();
    await pool.end();
  }
});

test('catalog manager is restricted to assigned branches', () => {
  const manager = {
    userId: 'manager-1',
    roles: ['CINEMA_MANAGER'],
    branchIds: ['branch-1'],
    mfaCompleted: false,
  };

  assert.doesNotThrow(() => requireCatalogManager(manager, 'branch-1'));
  assert.throws(() => requireCatalogManager(manager, 'branch-2'), /Branch access/);
});

test('platform admin operations require completed MFA', () => {
  const admin = {
    userId: 'admin-1',
    roles: ['PLATFORM_ADMIN'],
    branchIds: [],
    mfaCompleted: false,
  };

  assert.throws(() => requirePlatformAdmin(admin), /MFA/);
  assert.throws(() => requireCatalogManager(admin), /MFA/);
  assert.doesNotThrow(() =>
    requirePlatformAdmin({ ...admin, mfaCompleted: true }),
  );
});
