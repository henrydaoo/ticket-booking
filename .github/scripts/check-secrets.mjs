import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !file.endsWith('.example') && !file.endsWith('.example.local'));

const secretPatterns = [
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
];

const findings = [];
for (const file of trackedFiles) {
  const contents = await readFile(file, 'utf8');
  for (const pattern of secretPatterns) {
    if (pattern.test(contents)) {
      findings.push(`${file}: matched ${pattern}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Potential secrets found in tracked files:');
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Scanned ${trackedFiles.length} tracked files for high-confidence secret patterns.`);
}
