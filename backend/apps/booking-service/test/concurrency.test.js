const assert = require('node:assert/strict');
const test = require('node:test');

async function runConcurrently(task, count) {
  return Promise.all(Array.from({ length: count }, () => task()));
}

test('concurrency harness runs independent tasks together', async () => {
  let executions = 0;
  const results = await runConcurrently(async () => {
    executions += 1;
    return executions;
  }, 20);

  assert.equal(results.length, 20);
  assert.equal(new Set(results).size, 20);
});

