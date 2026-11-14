const fs = require('node:fs/promises');
const path = require('node:path');
const { config: loadDotenv } = require('dotenv');
const { Client } = require('pg');

loadDotenv({ path: path.join(__dirname, '../.env') });

const fixturePath = path.join(__dirname, '../../../test/fixtures/r1/catalog.json');
const ids = {
  cinema: '20000000-0000-4000-8000-000000000001',
  hcmBranch: '30000000-0000-4000-8000-000000000001',
  daNangBranch: '30000000-0000-4000-8000-000000000002',
  screen: '40000000-0000-4000-8000-000000000001',
  movieNowShowing: '50000000-0000-4000-8000-000000000001',
  movieComingSoon: '50000000-0000-4000-8000-000000000002',
  movieEnded: '50000000-0000-4000-8000-000000000003',
  showtimeOpen: '60000000-0000-4000-8000-000000000001',
  showtimeFuture: '60000000-0000-4000-8000-000000000002',
  showtimeDraft: '60000000-0000-4000-8000-000000000003',
  seatA1: '70000000-0000-4000-8000-000000000001',
  seatA2: '70000000-0000-4000-8000-000000000002',
  seatB1: '70000000-0000-4000-8000-000000000003',
  seatB2: '70000000-0000-4000-8000-000000000004',
};

const idMap = {
  'cinema-r1-001': ids.cinema,
  'branch-r1-hcm-001': ids.hcmBranch,
  'branch-r1-dn-001': ids.daNangBranch,
  'screen-r1-001': ids.screen,
  'movie-now-showing-001': ids.movieNowShowing,
  'movie-coming-soon-001': ids.movieComingSoon,
  'movie-ended-001': ids.movieEnded,
  'showtime-r1-open-001': ids.showtimeOpen,
  'showtime-r1-future-sale-001': ids.showtimeFuture,
  'showtime-r1-draft-001': ids.showtimeDraft,
  'seat-r1-a1': ids.seatA1,
  'seat-r1-a2': ids.seatA2,
  'seat-r1-b1': ids.seatB1,
  'seat-r1-b2': ids.seatB2,
};

function mapId(id) {
  const mapped = idMap[id];
  if (!mapped) {
    throw new Error(`No deterministic UUID mapping for ${id}`);
  }
  return mapped;
}

function shiftedTimes() {
  const now = Date.now();
  return {
    open: {
      start: new Date(now + 2 * 60 * 60 * 1000),
      end: new Date(now + 4 * 60 * 60 * 1000),
      saleOpens: new Date(now - 24 * 60 * 60 * 1000),
    },
    future: {
      start: new Date(now + 26 * 60 * 60 * 1000),
      end: new Date(now + 28 * 60 * 60 * 1000),
      saleOpens: new Date(now + 6 * 60 * 60 * 1000),
    },
    draft: {
      start: new Date(now + 50 * 60 * 60 * 1000),
      end: new Date(now + 52 * 60 * 60 * 1000),
      saleOpens: new Date(now + 24 * 60 * 60 * 1000),
    },
  };
}

async function seed() {
  const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const times = shiftedTimes();
  const cinema = fixture.cinemas[0];
  const movies = fixture.movies;
  const screen = fixture.screens[0];

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO cinemas (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
      [mapId(cinema.id), cinema.name],
    );

    for (const branch of fixture.branches) {
      await client.query(
        `INSERT INTO branches (id, cinema_id, name, address)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
         SET cinema_id = EXCLUDED.cinema_id, name = EXCLUDED.name,
             address = EXCLUDED.address, updated_at = NOW()`,
        [mapId(branch.id), mapId(branch.cinemaId), branch.name, `${branch.name} address`],
      );
    }

    for (const movie of movies) {
      await client.query(
        `INSERT INTO movies
           (id, title, description, duration_minutes, genre, age_rating,
            poster_url, trailer_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE
         SET title = EXCLUDED.title, description = EXCLUDED.description,
             duration_minutes = EXCLUDED.duration_minutes, genre = EXCLUDED.genre,
             age_rating = EXCLUDED.age_rating, poster_url = EXCLUDED.poster_url,
             trailer_url = EXCLUDED.trailer_url, status = EXCLUDED.status,
             updated_at = NOW()`,
        [
          mapId(movie.id),
          movie.title,
          `${movie.title} description`,
          movie.durationMinutes,
          movie.genre,
          movie.ageRating,
          `https://example.test/posters/${movie.id}.jpg`,
          `https://example.test/trailers/${movie.id}`,
          movie.status,
        ],
      );
    }

    await client.query(
      `INSERT INTO screens (id, branch_id, name, capacity, layout_version, pricing_version)
       VALUES ($1, $2, $3, $4, $5, 1)
       ON CONFLICT (id) DO UPDATE
       SET branch_id = EXCLUDED.branch_id, name = EXCLUDED.name,
           capacity = EXCLUDED.capacity, layout_version = EXCLUDED.layout_version`,
      [mapId(screen.id), mapId(screen.branchId), screen.name, screen.capacity, screen.layoutVersion],
    );
    for (const seat of screen.seats) {
      await client.query(
        `INSERT INTO screen_seats
           (id, screen_id, label, seat_type, row_label, seat_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
         SET screen_id = EXCLUDED.screen_id, label = EXCLUDED.label,
             seat_type = EXCLUDED.seat_type, row_label = EXCLUDED.row_label,
             seat_number = EXCLUDED.seat_number`,
        [
          mapId(seat.id),
          mapId(screen.id),
          seat.label,
          seat.type,
          seat.row,
          seat.number,
        ],
      );
    }
    for (const [seatType, priceVnd] of Object.entries(fixture.showtimes[0].prices)) {
      await client.query(
        `INSERT INTO screen_seat_type_prices (screen_id, seat_type, price_vnd)
         VALUES ($1, $2, $3)
         ON CONFLICT (screen_id, seat_type) DO UPDATE SET price_vnd = EXCLUDED.price_vnd,
           updated_at = NOW()`,
        [mapId(screen.id), seatType, priceVnd],
      );
    }

    const showtimeDefinitions = [
      [fixture.showtimes[0], times.open, 'PUBLISHED'],
      [fixture.showtimes[1], times.future, 'PUBLISHED'],
      [fixture.showtimes[2], times.draft, 'DRAFT'],
    ];
    for (const [showtime, schedule, status] of showtimeDefinitions) {
      const published = status === 'PUBLISHED';
      const seats = published ? screen.seats : null;
      await client.query(
        `INSERT INTO showtimes
           (id, movie_id, screen_id, start_at, end_at, sale_opens_at, status,
            published_at, prices, pricing_version, layout_version, seats)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
                 CASE WHEN $7 = 'PUBLISHED' THEN NOW() ELSE NULL END,
                 $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE
         SET movie_id = EXCLUDED.movie_id, screen_id = EXCLUDED.screen_id,
             start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at,
             sale_opens_at = EXCLUDED.sale_opens_at, status = EXCLUDED.status,
             published_at = EXCLUDED.published_at, prices = EXCLUDED.prices,
             pricing_version = EXCLUDED.pricing_version,
             layout_version = EXCLUDED.layout_version, seats = EXCLUDED.seats,
             updated_at = NOW()`,
        [
          mapId(showtime.id),
          mapId(showtime.movieId),
          mapId(showtime.screenId),
          schedule.start,
          schedule.end,
          schedule.saleOpens,
          status,
          published ? JSON.stringify(showtime.prices) : null,
          published ? showtime.pricingVersion : null,
          published ? showtime.layoutVersion : null,
          seats ? JSON.stringify(seats) : null,
        ],
      );
    }

    await client.query('COMMIT');
    console.log('Seeded R1 Catalog fixture with open, future-sale, and draft showtimes.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
