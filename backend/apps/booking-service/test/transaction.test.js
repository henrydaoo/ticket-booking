const assert = require('node:assert/strict');
const test = require('node:test');
const { TransactionRunner } = require('../dist/transaction.runner.js');

test('transaction runner rolls back and releases the client on failure', async () => {
  const calls = [];
  const client = {
    query: async (statement) => {
      calls.push(statement);
      if (statement === 'FAIL') {
        throw new Error('transaction failure');
      }
    },
    release: () => calls.push('release'),
  };
  const pool = {
    connect: async () => client,
  };

  const runner = new TransactionRunner(pool);

  await assert.rejects(
    runner.run(async (transactionClient) => {
      await transactionClient.query('FAIL');
    }),
    /transaction failure/,
  );

  assert.deepEqual(calls, ['BEGIN', 'FAIL', 'ROLLBACK', 'release']);
});

