const assert = require('node:assert/strict');
const test = require('node:test');
const { validateTestDatabaseConfiguration } = require('../scripts/test-database');

test('integration database requires an explicit confirmed test target', () => {
  assert.throws(() => validateTestDatabaseConfiguration('', '', ''), /required/);
  assert.throws(
    () => validateTestDatabaseConfiguration('postgres://localhost/catalog', 'catalog', ''),
    /end in _test/,
  );
  assert.throws(
    () => validateTestDatabaseConfiguration('postgres://localhost/catalog_test', 'other_test', ''),
    /match CATALOG_TEST_DATABASE_CONFIRM/,
  );
  assert.equal(
    validateTestDatabaseConfiguration('postgres://localhost/catalog_test', 'catalog_test', 'postgres://localhost/catalog'),
    'catalog_test',
  );
});

test('integration database must not be the configured application database', () => {
  assert.throws(
    () => validateTestDatabaseConfiguration(
      'postgres://tester@localhost/catalog_test',
      'catalog_test',
      'postgres://application@127.0.0.1/catalog_test',
    ),
    /must differ/,
  );
});
