const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { randomBytes, scrypt: callbackScrypt } = require('node:crypto');

const scrypt = promisify(callbackScrypt);
const backendRoot = path.join(__dirname, '..');
const serviceNodeModules = path.join(backendRoot, 'apps', 'catalog-service', 'node_modules');
const { Client } = require(path.join(serviceNodeModules, 'pg'));
const { parse } = require(path.join(serviceNodeModules, 'dotenv'));

function serviceEnvironment(service) {
  const file = path.join(backendRoot, 'apps', service, '.env');
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
  const environment = parse(fs.readFileSync(file));
  if (!environment.DATABASE_URL) {
    throw new Error(`${service} .env is missing DATABASE_URL`);
  }
  return environment;
}

async function connect(service) {
  const client = new Client({ connectionString: serviceEnvironment(service).DATABASE_URL });
  await client.connect();
  return client;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = Buffer.from(await scrypt(password, salt, 64));
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

const branchIds = [
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000004',
];
const cinemaIds = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
];
const screenDefinitions = Array.from({ length: 6 }, (_, index) => ({
  id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  branchId: branchIds[index % branchIds.length],
  name: `Screen ${index + 1}`,
  capacity: 8,
}));
const customerIds = Array.from({ length: 10 }, (_, index) =>
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const movieIds = Array.from({ length: 10 }, (_, index) =>
  `51000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const showtimeIds = Array.from({ length: 10 }, (_, index) =>
  `61000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
function seatIdsForScreen(screenIndex) {
  return Array.from({ length: 8 }, (_, seatIndex) =>
    `70000000-0000-4000-8000-${String(screenIndex * 8 + seatIndex + 1).padStart(12, '0')}`,
  );
}

async function seedIdentity() {
  const client = await connect('identity-service');
  try {
    await client.query('BEGIN');
    for (let index = 0; index < customerIds.length; index += 1) {
      const id = customerIds[index];
      const email = `r1r2.user${String(index + 1).padStart(2, '0')}@yopmail.com`;
      const role = index === 0
        ? 'PLATFORM_ADMIN'
        : index === 1
          ? 'CINEMA_MANAGER'
          : index === 2
            ? 'CINEMA_STAFF'
            : 'CUSTOMER';
      const passwordHash = await hashPassword(`R1R2-test-${index + 1}-Password!`);
      await client.query(
        `INSERT INTO users (id, email, password_hash, email_verified_at, mfa_enabled, mfa_secret)
         VALUES ($1, $2, $3, NOW(), $4, $5)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           email_verified_at = EXCLUDED.email_verified_at,
           mfa_enabled = EXCLUDED.mfa_enabled,
           mfa_secret = EXCLUDED.mfa_secret,
           updated_at = NOW()`,
        [id, email, passwordHash, role === 'PLATFORM_ADMIN', role === 'PLATFORM_ADMIN' ? 'JBSWY3DPEHPK3PXP' : null],
      );
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
      await client.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [id, role]);
      await client.query('DELETE FROM user_branch_assignments WHERE user_id = $1', [id]);
      if (role === 'CINEMA_MANAGER' || role === 'CINEMA_STAFF') {
        await client.query(
          'INSERT INTO user_branch_assignments (user_id, branch_id) VALUES ($1, $2)',
          [id, branchIds[0]],
        );
      }
    }
    await client.query('COMMIT');
    console.log(`Seeded ${customerIds.length} Identity users with @yopmail.com addresses.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function seedCatalog() {
  const client = await connect('catalog-service');
  try {
    await client.query('BEGIN');
    const legacyMovieIds = Array.from({ length: 10 }, (_, index) =>
      `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    const legacyShowtimeIdsToRemove = legacyMovieIds.slice(3).map((_, index) =>
      `60000000-0000-4000-8000-${String(index + 4).padStart(12, '0')}`,
    );
    await client.query(
      'DELETE FROM catalog_outbox_events WHERE event_id = ANY($1::uuid[])',
      [legacyShowtimeIdsToRemove],
    );
    await client.query(
      'DELETE FROM showtimes WHERE id = ANY($1::uuid[])',
      [legacyShowtimeIdsToRemove],
    );
    await client.query(
      `DELETE FROM movies WHERE id = ANY($1::uuid[]) AND id NOT IN ($2, $3, $4)`,
      [legacyMovieIds, legacyMovieIds[0], legacyMovieIds[1], legacyMovieIds[2]],
    );
    await client.query(
      `UPDATE movies
       SET title = $2, description = $3, duration_minutes = $4, genre = $5,
           age_rating = $6, poster_url = $7, trailer_url = $8, status = $9,
           updated_at = NOW()
       WHERE id = $1`,
      [
        legacyMovieIds[0],
        'R1 Fixture Movie',
        'R1 Fixture Movie description',
        120,
        'DRAMA',
        'T13',
        'https://example.test/posters/movie-now-showing-001.jpg',
        'https://example.test/trailers/movie-now-showing-001',
        'NOW_SHOWING',
      ],
    );
    await client.query(
      `UPDATE movies
       SET title = $2, description = $3, duration_minutes = $4, genre = $5,
           age_rating = $6, poster_url = $7, trailer_url = $8, status = $9,
           updated_at = NOW()
       WHERE id = $1`,
      [
        legacyMovieIds[1],
        'R1 Coming Soon Fixture',
        'R1 Coming Soon Fixture description',
        100,
        'COMEDY',
        'P',
        'https://example.test/posters/movie-coming-soon-001.jpg',
        'https://example.test/trailers/movie-coming-soon-001',
        'COMING_SOON',
      ],
    );
    await client.query(
      `UPDATE movies
       SET title = $2, description = $3, duration_minutes = $4, genre = $5,
           age_rating = $6, poster_url = $7, trailer_url = $8, status = $9,
           updated_at = NOW()
       WHERE id = $1`,
      [
        legacyMovieIds[2],
        'R1 Ended Fixture',
        'R1 Ended Fixture description',
        110,
        'ACTION',
        'T16',
        'https://example.test/posters/movie-ended-001.jpg',
        'https://example.test/trailers/movie-ended-001',
        'ENDED',
      ],
    );
    for (const [index, cinemaId] of cinemaIds.entries()) {
      await client.query(
        `INSERT INTO cinemas (id, name) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
        [cinemaId, index === 0 ? 'Cinema Booking Downtown' : 'Cinema Booking Riverside'],
      );
    }
    for (const [index, branchId] of branchIds.entries()) {
      await client.query(
        `INSERT INTO branches (id, cinema_id, name, address) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address,
           updated_at = NOW()`,
        [
          branchId,
          cinemaIds[index < 2 ? 0 : 1],
          `${index % 2 === 0 ? 'Downtown' : 'Riverside'} Branch ${index + 1}`,
          `${index + 1} Cinema Street`,
        ],
      );
    }
    for (const [screenIndex, screen] of screenDefinitions.entries()) {
      await client.query(
        `INSERT INTO screens (id, branch_id, name, capacity, layout_version, pricing_version)
         VALUES ($1, $2, $3, $4, 1, 1)
         ON CONFLICT (id) DO UPDATE SET branch_id = EXCLUDED.branch_id,
           name = EXCLUDED.name, capacity = EXCLUDED.capacity, updated_at = NOW()`,
        [screen.id, screen.branchId, screen.name, screen.capacity],
      );
      for (const [seatIndex, seatId] of seatIdsForScreen(screenIndex).entries()) {
        await client.query(
          `INSERT INTO screen_seats (id, screen_id, label, seat_type, row_label, seat_number)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label,
             seat_type = EXCLUDED.seat_type, row_label = EXCLUDED.row_label,
             seat_number = EXCLUDED.seat_number`,
          [
            seatId,
            screen.id,
            `${String.fromCharCode(65 + Math.floor(seatIndex / 4))}${(seatIndex % 4) + 1}`,
            seatIndex === 7 ? 'COUPLE' : seatIndex >= 4 ? 'VIP' : 'STANDARD',
            String.fromCharCode(65 + Math.floor(seatIndex / 4)),
            (seatIndex % 4) + 1,
          ],
        );
      }
      await client.query(
        `INSERT INTO screen_seat_type_prices (screen_id, seat_type, price_vnd)
         VALUES ($1, 'STANDARD', 90000), ($1, 'VIP', 120000), ($1, 'COUPLE', 180000)
         ON CONFLICT (screen_id, seat_type) DO UPDATE SET price_vnd = EXCLUDED.price_vnd,
           updated_at = NOW()`,
        [screen.id],
      );
    }
    for (const [index, movieId] of movieIds.entries()) {
      const status = index < 6 ? 'NOW_SHOWING' : index < 9 ? 'COMING_SOON' : 'ENDED';
      await client.query(
        `INSERT INTO movies
           (id, title, description, duration_minutes, genre, age_rating, poster_url, trailer_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title,
           description = EXCLUDED.description, duration_minutes = EXCLUDED.duration_minutes,
           genre = EXCLUDED.genre, age_rating = EXCLUDED.age_rating,
           poster_url = EXCLUDED.poster_url, trailer_url = EXCLUDED.trailer_url,
           status = EXCLUDED.status, updated_at = NOW()`,
        [
          movieId,
          `Cinema Story ${index + 1}`,
          `A seeded catalogue title for R1 and R2 flow verification (${index + 1}).`,
          95 + (index % 5) * 10,
          ['DRAMA', 'ACTION', 'COMEDY', 'SCI_FI', 'ANIMATION'][index % 5],
          index % 3 === 0 ? 'P' : index % 3 === 1 ? 'T13' : 'T16',
          `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80&sig=${index + 1}`,
          `https://example.test/trailers/cinema-story-${index + 1}`,
          status,
        ],
      );
    }
    const now = Date.now();
    for (const [index, showtimeId] of showtimeIds.entries()) {
      const screen = screenDefinitions[index % screenDefinitions.length];
      const screenSeatIds = seatIdsForScreen(index % screenDefinitions.length);
      const seats = screenSeatIds.map((id, seatIndex) => ({
        id,
        label: `${String.fromCharCode(65 + Math.floor(seatIndex / 4))}${(seatIndex % 4) + 1}`,
        type: seatIndex === 7 ? 'COUPLE' : seatIndex >= 4 ? 'VIP' : 'STANDARD',
        row: String.fromCharCode(65 + Math.floor(seatIndex / 4)),
        number: (seatIndex % 4) + 1,
      }));
      const start = new Date(now + (2 + index * 4) * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const saleOpensAt = new Date(now - 60 * 60 * 1000);
      const payload = {
        showtimeId,
        movieId: movieIds[index],
        branchId: screen.branchId,
        screenId: screen.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        saleOpensAt: saleOpensAt.toISOString(),
        reservationCutoffAt: new Date(start.getTime() - 15 * 60 * 1000).toISOString(),
        prices: { STANDARD: 90000, VIP: 120000, COUPLE: 180000 },
        pricingVersion: 1,
        layoutVersion: 1,
        seats,
      };
      const event = {
        eventId: showtimeId,
        eventType: 'ShowtimePublished',
        schemaVersion: 1,
        aggregateType: 'Showtime',
        aggregateId: showtimeId,
        occurredAt: new Date().toISOString(),
        correlationId: `r1r2-seed:${showtimeId}`,
        payload,
      };
      await client.query(
        `INSERT INTO showtimes
           (id, movie_id, screen_id, start_at, end_at, sale_opens_at, status,
            published_at, prices, pricing_version, layout_version, seats)
         VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED', NOW(), $7, 1, 1, $8)
         ON CONFLICT (id) DO UPDATE SET movie_id = EXCLUDED.movie_id,
           screen_id = EXCLUDED.screen_id, start_at = EXCLUDED.start_at,
           end_at = EXCLUDED.end_at, sale_opens_at = EXCLUDED.sale_opens_at,
           status = EXCLUDED.status, published_at = EXCLUDED.published_at,
           prices = EXCLUDED.prices, pricing_version = 1, layout_version = 1,
           seats = EXCLUDED.seats, updated_at = NOW()`,
        [showtimeId, movieIds[index], screen.id, start, end, saleOpensAt, JSON.stringify(payload.prices), JSON.stringify(seats)],
      );
      await client.query(
        `INSERT INTO catalog_outbox_events
           (event_id, event_type, schema_version, aggregate_type, aggregate_id,
            correlation_id, occurred_at, payload)
         VALUES ($1, 'ShowtimePublished', 1, 'Showtime', $1, $2, NOW(), $3)
         ON CONFLICT (event_id) DO NOTHING`,
        [showtimeId, event.correlationId, JSON.stringify(event)],
      );
    }
    await client.query('COMMIT');
    console.log(`Seeded ${movieIds.length} movies and ${showtimeIds.length} published showtimes.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function seedBookingAndPayment() {
  const booking = await connect('booking-service');
  const payment = await connect('payment-service');
  const bookingIds = Array.from({ length: 10 }, (_, index) =>
    `80000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  );
  const reservationIds = Array.from({ length: 10 }, (_, index) =>
    `81000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  );
  const paymentIds = Array.from({ length: 10 }, (_, index) =>
    `82000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  );
  try {
    await booking.query('BEGIN');
    for (let index = 0; index < bookingIds.length; index += 1) {
      const reservationId = reservationIds[index];
      const showtimeId = showtimeIds[index];
      const showtimeSeatIds = seatIdsForScreen(index % screenDefinitions.length);
      const seatId = showtimeSeatIds[index % 8];
      const status = index === 0 ? 'CONFIRMED' : index < 3 ? 'PENDING_PAYMENT' : 'CANCELLED';
      for (const [seatIndex, availableSeatId] of showtimeSeatIds.entries()) {
        await booking.query(
          `INSERT INTO showtime_seats
             (showtime_id, seat_id, seat_label, seat_type, status, price_vnd)
           VALUES ($1, $2, $3, $4, 'AVAILABLE', $5)
           ON CONFLICT (showtime_id, seat_id) DO NOTHING`,
          [
            showtimeId,
            availableSeatId,
            `${String.fromCharCode(65 + Math.floor(seatIndex / 4))}${(seatIndex % 4) + 1}`,
            seatIndex === 7 ? 'COUPLE' : seatIndex >= 4 ? 'VIP' : 'STANDARD',
            seatIndex === 7 ? 180000 : seatIndex >= 4 ? 120000 : 90000,
          ],
        );
      }
      await booking.query(
        `INSERT INTO showtime_seats (showtime_id, seat_id, seat_label, seat_type, status, reservation_id, booking_id, price_vnd)
         VALUES ($1, $2, $3, 'STANDARD', $4, $5, $6, 90000)
         ON CONFLICT (showtime_id, seat_id) DO UPDATE SET status = EXCLUDED.status,
           reservation_id = EXCLUDED.reservation_id, booking_id = EXCLUDED.booking_id,
           price_vnd = EXCLUDED.price_vnd, updated_at = NOW()`,
        [showtimeId, seatId, `S${index + 1}`, status === 'CONFIRMED' ? 'BOOKED' : 'AVAILABLE', reservationId, bookingIds[index]],
      );
      await booking.query(
        `INSERT INTO reservations (id, customer_id, showtime_id, status, expires_at, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
        [reservationId, customerIds[(index + 3) % customerIds.length], showtimeId, status === 'CONFIRMED' ? 'CONFIRMED' : status === 'PENDING_PAYMENT' ? 'PAYMENT_PENDING' : 'CANCELLED', new Date(Date.now() + 5 * 60 * 1000), `r1r2-reservation-${index + 1}`],
      );
      await booking.query(
        `INSERT INTO reservation_seats (reservation_id, showtime_id, seat_id, price_vnd)
         VALUES ($1, $2, $3, 90000)
         ON CONFLICT (reservation_id, seat_id) DO UPDATE SET price_vnd = EXCLUDED.price_vnd`,
        [reservationId, showtimeId, seatId],
      );
      await booking.query(
        `INSERT INTO bookings (id, customer_id, reservation_id, showtime_id, status, total_vnd, payment_deadline_at, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, 90000, $6, $7)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, total_vnd = 90000,
           payment_deadline_at = EXCLUDED.payment_deadline_at, updated_at = NOW()`,
        [bookingIds[index], customerIds[(index + 3) % customerIds.length], reservationId, showtimeId, status, new Date(Date.now() + 10 * 60 * 1000), `r1r2-booking-${index + 1}`],
      );
      await booking.query(
        `INSERT INTO booking_seats (booking_id, seat_id, price_vnd)
         VALUES ($1, $2, 90000)
         ON CONFLICT (booking_id, seat_id) DO UPDATE SET price_vnd = EXCLUDED.price_vnd`,
        [bookingIds[index], seatId],
      );
    }
    await booking.query('COMMIT');

    await payment.query('BEGIN');
    for (let index = 0; index < bookingIds.length; index += 1) {
      const paymentStatus = index === 0 ? 'SUCCEEDED' : index < 3 ? 'PENDING' : 'FAILED';
      await payment.query(
        `INSERT INTO payments
           (id, booking_id, customer_id, idempotency_key, amount_vnd, status, provider,
            provider_reference, processing_deadline_at, payment_url)
         VALUES ($1, $2, $3, $4, 90000, $5, 'VNPAY', $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status,
           provider_reference = EXCLUDED.provider_reference, updated_at = NOW()`,
        [paymentIds[index], bookingIds[index], customerIds[(index + 3) % customerIds.length], `r1r2-payment-${index + 1}`, paymentStatus, `seed-vnpay-${index + 1}`, new Date(Date.now() + 10 * 60 * 1000), 'http://localhost:3007/payment/return'],
      );
    }
    await payment.query('COMMIT');
    console.log(`Seeded ${bookingIds.length} Booking records and ${bookingIds.length} Payment records.`);
  } catch (error) {
    await booking.query('ROLLBACK').catch(() => undefined);
    await payment.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await booking.end();
    await payment.end();
  }
}

async function main() {
  await seedIdentity();
  await seedCatalog();
  await seedBookingAndPayment();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
