const assert = require('node:assert/strict');
const test = require('node:test');
const {
  adminHeaders,
  cleanupFixture,
  createFixture,
  managerHeaders,
  newFixture,
  startCatalog,
} = require('./catalog-test-support');

let context;
let fixture;

test.beforeEach(async () => {
  context = await startCatalog();
  fixture = newFixture();
  await createFixture(context, fixture);
});

test.afterEach(async () => {
  if (context) {
    try {
      await cleanupFixture(context, fixture);
    } finally {
      await context.close();
      context = undefined;
    }
  }
});

test('movie discovery filters the created movie by search and status', async () => {
  const result = await context.request(`/movies?search=${fixture.tag}&status=NOW_SHOWING`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.map((movie) => movie.id), [fixture.movieId]);
});

test('movie management rejects a cinema manager without platform admin authority', async () => {
  const result = await context.request('/movies', {
    method: 'POST',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({
      title: 'Forbidden',
      description: 'Should not be created',
      durationMinutes: 90,
      genre: 'DRAMA',
      ageRating: 'T13',
      posterUrl: 'https://example.test/forbidden.png',
      trailerUrl: 'https://example.test/forbidden.mp4',
      status: 'COMING_SOON',
    }),
  });
  assert.equal(result.status, 403);
});

test('platform admin must complete MFA for movie management', async () => {
  const result = await context.request(`/movies/${fixture.movieId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'x-authenticated-mfa-completed': 'false' },
    body: JSON.stringify({ title: 'Unauthorized update' }),
  });
  assert.equal(result.status, 403);
});

test('screen management rejects a manager from another branch', async () => {
  const result = await context.request('/screens', {
    method: 'POST',
    headers: managerHeaders('00000000-0000-0000-0000-000000000001'),
    body: JSON.stringify({ branchId: fixture.branchId, name: 'Other screen', capacity: 2 }),
  });
  assert.equal(result.status, 403);
});

test('layout changes require a seat count matching screen capacity', async () => {
  const result = await context.request(`/screens/${fixture.screenId}/layout`, {
    method: 'PUT',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({
      seats: [{ label: 'A1', type: 'STANDARD', row: 'A', number: 1 }],
    }),
  });
  assert.equal(result.status, 409);
});

test('fixture cleanup leaves other fixtures and their screen data intact', async () => {
  const other = newFixture();
  try {
    await createFixture(context, other);
    await cleanupFixture(context, fixture);
    fixture = undefined;
    const result = await context.database.query(
      `SELECT
         (SELECT COUNT(*) FROM movies WHERE id = $1) AS movies,
         (SELECT COUNT(*) FROM screens WHERE id = $2) AS screens,
         (SELECT COUNT(*) FROM screen_seats WHERE screen_id = $2) AS seats,
         (SELECT COUNT(*) FROM screen_seat_type_prices WHERE screen_id = $2) AS prices`,
      [other.movieId, other.screenId],
    );
    assert.deepEqual(result.rows[0], { movies: '1', screens: '1', seats: '2', prices: '2' });
  } finally {
    await cleanupFixture(context, other);
  }
});
