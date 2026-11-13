const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { config: loadDotenv } = require('dotenv');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { Pool } = require('pg');
const { AppModule } = require('../dist/app.module.js');

loadDotenv({ path: path.join(__dirname, '../.env') });

const adminHeaders = {
  'content-type': 'application/json',
  'x-authenticated-user-id': 'admin-r1',
  'x-authenticated-roles': JSON.stringify(['PLATFORM_ADMIN']),
  'x-authenticated-branch-ids': JSON.stringify([]),
  'x-authenticated-mfa-completed': 'true',
};

const managerHeaders = (branchId) => ({
  'content-type': 'application/json',
  'x-authenticated-user-id': 'manager-r1',
  'x-authenticated-roles': JSON.stringify(['CINEMA_MANAGER']),
  'x-authenticated-branch-ids': JSON.stringify([branchId]),
  'x-authenticated-mfa-completed': 'false',
});

let app;
let database;
let baseUrl;
let cinemaId;
let branchId;
let screenId;

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

test.before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Catalog integration tests');
  }
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  database = app.get(Pool);
});

test.after(async () => {
  if (database) {
    await database.query('DELETE FROM screen_seat_type_prices');
    await database.query('DELETE FROM screen_seats');
    await database.query('DELETE FROM screens');
    await database.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await database.query('DELETE FROM cinemas WHERE id = $1', [cinemaId]);
    await database.query('DELETE FROM movies WHERE title = $1', ['R1 Integration Movie']);
    await database.end();
  }
  if (app) {
    await app.close();
  }
});

test('Catalog R1.3 supports discovery, management authorization, and layouts', async () => {
  const movie = await request('/movies', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'R1 Integration Movie',
      description: 'Catalog integration fixture',
      durationMinutes: 120,
      genre: 'DRAMA',
      ageRating: 'T13',
      posterUrl: 'https://example.test/movie.png',
      trailerUrl: 'https://example.test/movie.mp4',
      status: 'NOW_SHOWING',
    }),
  });
  assert.equal(movie.status, 201);

  const filtered = await request('/movies?search=Integration&status=NOW_SHOWING');
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.length, 1);

  const forbiddenMovie = await request('/movies', {
    method: 'POST',
    headers: {
      ...managerHeaders('00000000-0000-0000-0000-000000000001'),
    },
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
  assert.equal(forbiddenMovie.status, 403);

  const cinema = await request('/cinemas', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'R1 Integration Cinema' }),
  });
  assert.equal(cinema.status, 201);
  cinemaId = cinema.body.id;

  const branch = await request('/branches', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      cinemaId,
      name: 'R1 Integration Branch',
      address: 'Test address',
    }),
  });
  assert.equal(branch.status, 201);
  branchId = branch.body.id;

  const screen = await request('/screens', {
    method: 'POST',
    headers: managerHeaders(branchId),
    body: JSON.stringify({ branchId, name: 'Screen 1', capacity: 2 }),
  });
  assert.equal(screen.status, 201);
  screenId = screen.body.id;

  const wrongBranch = await request('/screens', {
    method: 'POST',
    headers: managerHeaders('00000000-0000-0000-0000-000000000001'),
    body: JSON.stringify({ branchId, name: 'Screen 2', capacity: 2 }),
  });
  assert.equal(wrongBranch.status, 403);

  const layout = await request(`/screens/${screenId}/layout`, {
    method: 'PUT',
    headers: managerHeaders(branchId),
    body: JSON.stringify({
      seats: [
        { label: 'A1', type: 'STANDARD', row: 'A', number: 1 },
        { label: 'A2', type: 'VIP', row: 'A', number: 2 },
      ],
    }),
  });
  assert.equal(layout.status, 200);
  assert.equal(layout.body.layoutVersion, 2);

  const invalidLayout = await request(`/screens/${screenId}/layout`, {
    method: 'PUT',
    headers: managerHeaders(branchId),
    body: JSON.stringify({
      seats: [{ label: 'A1', type: 'STANDARD', row: 'A', number: 1 }],
    }),
  });
  assert.equal(invalidLayout.status, 409);
});
