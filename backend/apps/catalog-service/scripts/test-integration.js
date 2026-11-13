const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { configureTestDatabase } = require('./test-database');

async function main() {
  const options = process.argv.slice(2);
  if (options.some((option) =>
    !option.startsWith('--test-name-pattern=') && !option.startsWith('--test-file='))) {
    throw new Error('Only --test-name-pattern=<pattern> and --test-file=<file> are supported');
  }
  const fileOptions = options.filter((option) => option.startsWith('--test-file='));
  if (fileOptions.length > 1) throw new Error('Only one --test-file may be specified');
  const selectedFile = fileOptions[0]?.slice('--test-file='.length);
  const testOptions = options.filter((option) => option.startsWith('--test-name-pattern='));
  await configureTestDatabase();
  const serviceDirectory = path.join(__dirname, '..');
  const availableFiles = fs.readdirSync(path.join(serviceDirectory, 'test'))
    .filter((file) => file.endsWith('.integration.js'))
    .sort();
  if (fileOptions.length && !availableFiles.includes(selectedFile)) {
    throw new Error('The requested Catalog integration test file does not exist');
  }
  const files = (selectedFile ? [selectedFile] : availableFiles)
    .map((file) => path.join('test', file));

  if (files.length === 0) {
    throw new Error('No Catalog integration test files found');
  }

  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  try {
    const acquired = await lock.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
      1128354865,
      1,
    ]);
    if (!acquired.rows[0].acquired) {
      throw new Error('Another Catalog integration run is using the test database');
    }

    for (const args of [
      [path.join('scripts', 'migrate.js')],
      ['--test', '--test-concurrency=1', ...testOptions, ...files],
    ]) {
      const result = spawnSync(process.execPath, args, {
        cwd: serviceDirectory,
        env: process.env,
        stdio: 'inherit',
      });
      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        throw new Error(`Catalog integration command failed with status ${result.status}`);
      }
    }
  } finally {
    await lock.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
