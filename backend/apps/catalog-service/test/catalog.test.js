const assert = require('node:assert/strict');
const test = require('node:test');
const {
  requireCatalogManager,
  requirePlatformAdmin,
} = require('../dist/common/principal.js');

test('catalog manager is restricted to assigned branches', () => {
  const manager = {
    userId: 'manager-1',
    roles: ['CINEMA_MANAGER'],
    branchIds: ['branch-1'],
    mfaCompleted: false,
  };

  assert.doesNotThrow(() => requireCatalogManager(manager, 'branch-1'));
  assert.throws(() => requireCatalogManager(manager, 'branch-2'), /Branch access/);
});

test('platform admin operations require completed MFA', () => {
  const admin = {
    userId: 'admin-1',
    roles: ['PLATFORM_ADMIN'],
    branchIds: [],
    mfaCompleted: false,
  };

  assert.throws(() => requirePlatformAdmin(admin), /MFA/);
  assert.throws(() => requireCatalogManager(admin), /MFA/);
  assert.doesNotThrow(() =>
    requirePlatformAdmin({ ...admin, mfaCompleted: true }),
  );
});
