CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  genre TEXT NOT NULL,
  age_rating TEXT NOT NULL,
  poster_url TEXT NOT NULL,
  trailer_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMING_SOON', 'NOW_SHOWING', 'ENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cinemas (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY,
  cinema_id UUID NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cinema_id, name)
);

CREATE TABLE IF NOT EXISTS screens (
  id UUID PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  layout_version INTEGER NOT NULL DEFAULT 1 CHECK (layout_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, name)
);

CREATE TABLE IF NOT EXISTS screen_seats (
  id UUID PRIMARY KEY,
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  seat_type TEXT NOT NULL CHECK (seat_type IN ('STANDARD', 'VIP', 'COUPLE')),
  row_label TEXT NOT NULL,
  seat_number INTEGER NOT NULL CHECK (seat_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (screen_id, label),
  UNIQUE (screen_id, row_label, seat_number)
);

CREATE TABLE IF NOT EXISTS screen_seat_type_prices (
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  seat_type TEXT NOT NULL CHECK (seat_type IN ('STANDARD', 'VIP', 'COUPLE')),
  price_vnd INTEGER NOT NULL CHECK (price_vnd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (screen_id, seat_type)
);
