const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Module, ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { config: loadDotenv } = require('dotenv');
const { Pool } = require('pg');
const { configureTestDatabase } = require('../scripts/test-database');
const { DatabaseModule } = require('../dist/infrastructure/database/database.module');
const { CinemasModule } = require('../dist/modules/cinemas/cinemas.module');
const { MoviesModule } = require('../dist/modules/movies/movies.module');
const { ScreensModule } = require('../dist/modules/screens/screens.module');
const { ShowtimesModule } = require('../dist/modules/showtimes/showtimes.module');
const { correlationIdMiddleware } = require('../dist/correlation-id.middleware');

class CatalogIntegrationModule {}
Module({
  imports: [DatabaseModule, MoviesModule, CinemasModule, ScreensModule, ShowtimesModule],
})(CatalogIntegrationModule);

const adminHeaders = {
  'content-type': 'application/json',
  'x-authenticated-user-id': 'integration-admin',
  'x-authenticated-roles': JSON.stringify(['PLATFORM_ADMIN']),
  'x-authenticated-branch-ids': JSON.stringify([]),
  'x-authenticated-mfa-completed': 'true',
};

function managerHeaders(branchId) {
  return {
    'content-type': 'application/json',
    'x-authenticated-user-id': 'integration-manager',
    'x-authenticated-roles': JSON.stringify(['CINEMA_MANAGER']),
    'x-authenticated-branch-ids': JSON.stringify([branchId]),
    'x-authenticated-mfa-completed': 'false',
  };
}

async function startCatalog() {
  await configureTestDatabase({ targetSelected: true });
  loadDotenv({ path: path.join(__dirname, '../.env') });
  const app = await NestFactory.create(CatalogIntegrationModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  }));
  app.use(correlationIdMiddleware);
  await app.listen(0, '127.0.0.1');
  const database = app.get(Pool);
  const baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;

  async function request(route, options = {}) {
    const response = await fetch(`${baseUrl}${route}`, options);
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : undefined,
    };
  }

  return {
    app,
    database,
    request,
    async close() {
      await app.close();
      await database.end();
    },
  };
}

function newFixture() {
  return { tag: randomUUID() };
}

async function createFixture(context, fixture) {
  const { request } = context;
  const movie = await request('/movies', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: `Catalog test ${fixture.tag}`,
      description: 'Catalog test fixture',
      durationMinutes: 120,
      genre: 'DRAMA',
      ageRating: 'T13',
      posterUrl: 'https://example.test/movie.png',
      trailerUrl: 'https://example.test/movie.mp4',
      status: 'NOW_SHOWING',
    }),
  });
  assert.equal(movie.status, 201);
  fixture.movieId = movie.body.id;
  const cinema = await request('/cinemas', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: `Cinema ${fixture.tag}` }),
  });
  assert.equal(cinema.status, 201);
  fixture.cinemaId = cinema.body.id;
  const branch = await request('/branches', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      cinemaId: fixture.cinemaId,
      name: `Branch ${fixture.tag}`,
      address: 'Catalog test fixture',
    }),
  });
  assert.equal(branch.status, 201);
  fixture.branchId = branch.body.id;
  const screen = await request('/screens', {
    method: 'POST',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({ branchId: fixture.branchId, name: 'Screen 1', capacity: 2 }),
  });
  assert.equal(screen.status, 201);
  fixture.screenId = screen.body.id;
  const layout = await request(`/screens/${fixture.screenId}/layout`, {
    method: 'PUT',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({
      seats: [
        { label: 'A1', type: 'STANDARD', row: 'A', number: 1 },
        { label: 'A2', type: 'VIP', row: 'A', number: 2 },
      ],
    }),
  });
  assert.equal(layout.status, 200);
  fixture.layoutVersion = layout.body.layoutVersion;
  const prices = await setPrices(context, fixture, 90000, 120000);
  assert.equal(prices.status, 200);
  fixture.pricingVersion = prices.body.pricingVersion;
}

function setPrices(context, fixture, standard, vip) {
  return context.request(`/screens/${fixture.screenId}/prices`, {
    method: 'PUT',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({
      prices: [
        { seatType: 'STANDARD', priceVnd: standard },
        { seatType: 'VIP', priceVnd: vip },
      ],
    }),
  });
}

async function cleanupFixture(context, fixture) {
  if (!fixture) return;
  const database = context.database;
  if (fixture.movieId) {
    await database.query(
      `DELETE FROM catalog_outbox_events
       WHERE aggregate_id IN (SELECT id FROM showtimes WHERE movie_id = $1)`,
      [fixture.movieId],
    );
    await database.query('DELETE FROM showtimes WHERE movie_id = $1', [fixture.movieId]);
  }
  if (fixture.screenId) {
    await database.query('DELETE FROM screen_seat_type_prices WHERE screen_id = $1', [fixture.screenId]);
    await database.query('DELETE FROM screen_seats WHERE screen_id = $1', [fixture.screenId]);
    await database.query('DELETE FROM screens WHERE id = $1', [fixture.screenId]);
  }
  if (fixture.branchId) {
    await database.query('DELETE FROM branches WHERE id = $1', [fixture.branchId]);
  }
  if (fixture.cinemaId) {
    await database.query('DELETE FROM cinemas WHERE id = $1', [fixture.cinemaId]);
  }
  if (fixture.movieId) {
    await database.query('DELETE FROM movies WHERE id = $1', [fixture.movieId]);
  }
}

function showtimeInput(fixture, startAt, endAt, saleOpensAt) {
  return {
    movieId: fixture.movieId,
    screenId: fixture.screenId,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    ...(saleOpensAt ? { saleOpensAt: saleOpensAt.toISOString() } : {}),
  };
}

function createDraft(context, fixture, startAt, endAt, saleOpensAt) {
  return context.request('/showtimes', {
    method: 'POST',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify(showtimeInput(fixture, startAt, endAt, saleOpensAt)),
  });
}

module.exports = {
  adminHeaders,
  cleanupFixture,
  createDraft,
  createFixture,
  managerHeaders,
  newFixture,
  setPrices,
  showtimeInput,
  startCatalog,
};
