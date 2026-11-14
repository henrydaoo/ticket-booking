const fs = require('node:fs');
const path = require('node:path');
const { config, parse } = require('dotenv');
const { Client } = require('pg');

const serviceDirectory = path.join(__dirname, '..');

function databaseName(connectionString, variableName) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`${variableName} must be a PostgreSQL connection URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${variableName} must be a PostgreSQL connection URL`);
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name || name.includes('/')) {
    throw new Error(`${variableName} must specify a database name`);
  }
  return name;
}

function validateTestDatabaseConfiguration(testUrl, confirmation, applicationUrl) {
  if (!testUrl || !confirmation) {
    throw new Error(
      'CATALOG_TEST_DATABASE_URL and CATALOG_TEST_DATABASE_CONFIRM are required',
    );
  }
  const name = databaseName(testUrl, 'CATALOG_TEST_DATABASE_URL');
  if (!name.endsWith('_test') || confirmation !== name) {
    throw new Error(
      'The test database name must end in _test and match CATALOG_TEST_DATABASE_CONFIRM',
    );
  }
  if (applicationUrl && databaseName(applicationUrl, 'DATABASE_URL') === name) {
    throw new Error('The test database must differ from the application database');
  }
  return name;
}

async function configureTestDatabase({ targetSelected = false } = {}) {
  config({ path: path.join(serviceDirectory, '.env.test'), quiet: true });
  const applicationEnvironmentPath = path.join(serviceDirectory, '.env');
  const applicationEnvironment = fs.existsSync(applicationEnvironmentPath)
    ? parse(fs.readFileSync(applicationEnvironmentPath))
    : {};
  const testUrl = process.env.CATALOG_TEST_DATABASE_URL;
  const name = validateTestDatabaseConfiguration(
    testUrl,
    process.env.CATALOG_TEST_DATABASE_CONFIRM,
    applicationEnvironment.DATABASE_URL,
  );
  if (targetSelected) {
    if (process.env.DATABASE_URL !== testUrl) {
      throw new Error('Integration tests must use the explicitly selected test database');
    }
  } else if (process.env.DATABASE_URL) {
    validateTestDatabaseConfiguration(
      testUrl,
      process.env.CATALOG_TEST_DATABASE_CONFIRM,
      process.env.DATABASE_URL,
    );
  }
  const client = new Client({ connectionString: testUrl });
  await client.connect();
  try {
    const result = await client.query('SELECT current_database() AS name');
    if (result.rows[0].name !== name) {
      throw new Error('Connected database does not match the confirmed test database');
    }
  } finally {
    await client.end();
  }
  process.env.DATABASE_URL = testUrl;
}

module.exports = { configureTestDatabase, validateTestDatabaseConfiguration };
