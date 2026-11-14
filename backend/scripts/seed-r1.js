const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const steps = [
  ['Identity', 'apps/identity-service/scripts/migrate.js'],
  ['Catalog', 'apps/catalog-service/scripts/migrate.js'],
  ['Identity', 'apps/identity-service/scripts/seed-r1.js'],
  ['Catalog', 'apps/catalog-service/scripts/seed-r1.js'],
];

for (const [name, script] of steps) {
  const result = spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`${name} seed step failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log('R1 local seed completed. Booking, Payment, Ticket, Notification, and Gateway have no seedable business schema.');
