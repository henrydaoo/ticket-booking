const fs = require('node:fs/promises');
const path = require('node:path');
const { config: loadDotenv } = require('dotenv');
const { Client } = require('pg');

loadDotenv({ path: path.join(__dirname, '../.env') });

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    const migrationsDirectory = path.join(__dirname, '../migrations');
    const migrationFiles = (await fs.readdir(migrationsDirectory))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();

    for (const migrationFile of migrationFiles) {
      const migration = await fs.readFile(
        path.join(migrationsDirectory, migrationFile),
        'utf8',
      );
      await client.query(migration);
    }

    console.log('Catalog migrations applied.');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
