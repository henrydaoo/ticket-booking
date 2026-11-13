const fs = require('node:fs/promises');
const path = require('node:path');
const { config: loadDotenv } = require('dotenv');
const { Client } = require('pg');

loadDotenv({ path: path.join(__dirname, '../.env') });

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    const migration = await fs.readFile(
      path.join(__dirname, '../migrations/001-catalog.sql'),
      'utf8',
    );
    await client.query(migration);
    console.log('Catalog migrations applied.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
