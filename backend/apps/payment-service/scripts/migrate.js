const fs = require('node:fs/promises');
const path = require('node:path');
const { config: loadDotenv } = require('dotenv');
const { Client } = require('pg');

loadDotenv({ path: path.join(__dirname, '../.env') });

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const directory = path.join(__dirname, '../migrations');
    const files = (await fs.readdir(directory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
    for (const file of files) {
      await client.query(await fs.readFile(path.join(directory, file), 'utf8'));
    }
    console.log(`Payment migrations applied: ${files.length}.`);
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

