const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync } = require('node:crypto');

const outputDirectory = path.join(__dirname, '../dev-keys');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'private.pem'), privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(outputDirectory, 'public.pem'), publicKey, { mode: 0o644 });
console.log(`Development JWT keys generated in ${outputDirectory}`);
