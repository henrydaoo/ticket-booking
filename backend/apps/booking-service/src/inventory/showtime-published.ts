export type ShowtimePublishedEvent = {
  eventId: string;
  eventType: 'ShowtimePublished';
  schemaVersion: 1;
  aggregateType: 'Showtime';
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  payload: {
    showtimeId: string;
    movieId: string;
    branchId: string;
    screenId: string;
    startAt: string;
    endAt: string;
    saleOpensAt: string;
    reservationCutoffAt: string;
    prices: Record<string, number>;
    pricingVersion: number;
    layoutVersion: number;
    seats: Array<{
      id: string;
      label: string;
      type: string;
      row: string;
      number: number;
    }>;
  };
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`ShowtimePublished.${field} must be a non-empty string`);
  }
  return value;
}

function uuid(value: unknown, field: string): string {
  const parsed = requiredString(value, field);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      parsed,
    )
  ) {
    throw new Error(`ShowtimePublished.${field} must be a UUID`);
  }
  return parsed;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`ShowtimePublished.${field} must be a positive integer`);
  }
  return value as number;
}

export function parseShowtimePublishedEvent(value: unknown): ShowtimePublishedEvent {
  if (!value || typeof value !== 'object') {
    throw new Error('ShowtimePublished event must be an object');
  }

  const event = value as Record<string, unknown>;
  if (event.eventType !== 'ShowtimePublished' || event.schemaVersion !== 1) {
    throw new Error('Unsupported ShowtimePublished event version');
  }
  if (event.aggregateType !== 'Showtime') {
    throw new Error('ShowtimePublished.aggregateType must be Showtime');
  }

  const payload = event.payload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('ShowtimePublished.payload must be an object');
  }

  const rawPayload = payload as Record<string, unknown>;
  const seats = rawPayload.seats;
  const prices = rawPayload.prices;
  if (!Array.isArray(seats) || seats.length === 0) {
    throw new Error('ShowtimePublished.payload.seats must not be empty');
  }
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
    throw new Error('ShowtimePublished.payload.prices must be an object');
  }

  const parsedSeats = seats.map((seat, index) => {
    if (!seat || typeof seat !== 'object') {
      throw new Error(`ShowtimePublished.payload.seats[${index}] must be an object`);
    }
    const rawSeat = seat as Record<string, unknown>;
    return {
      id: uuid(rawSeat.id, `payload.seats[${index}].id`),
      label: requiredString(rawSeat.label, `payload.seats[${index}].label`),
      type: requiredString(rawSeat.type, `payload.seats[${index}].type`),
      row: requiredString(rawSeat.row, `payload.seats[${index}].row`),
      number: positiveInteger(rawSeat.number, `payload.seats[${index}].number`),
    };
  });
  const seatIds = new Set(parsedSeats.map((seat) => seat.id));
  if (seatIds.size !== parsedSeats.length) {
    throw new Error('ShowtimePublished.payload.seats must have unique IDs');
  }

  const parsedPrices = Object.fromEntries(
    Object.entries(prices).map(([seatType, price]) => {
      if (!Number.isInteger(price) || (price as number) < 0) {
        throw new Error(`ShowtimePublished.payload.prices.${seatType} must be a non-negative integer`);
      }
      return [seatType, price];
    }),
  );
  for (const seat of parsedSeats) {
    if (!(seat.type in parsedPrices)) {
      throw new Error(`Missing price for seat type ${seat.type}`);
    }
  }

  return {
    eventId: uuid(event.eventId, 'eventId'),
    eventType: 'ShowtimePublished',
    schemaVersion: 1,
    aggregateType: 'Showtime',
    aggregateId: uuid(event.aggregateId, 'aggregateId'),
    occurredAt: requiredString(event.occurredAt, 'occurredAt'),
    correlationId: requiredString(event.correlationId, 'correlationId'),
    payload: {
      showtimeId: uuid(rawPayload.showtimeId, 'payload.showtimeId'),
      movieId: uuid(rawPayload.movieId, 'payload.movieId'),
      branchId: uuid(rawPayload.branchId, 'payload.branchId'),
      screenId: uuid(rawPayload.screenId, 'payload.screenId'),
      startAt: requiredString(rawPayload.startAt, 'payload.startAt'),
      endAt: requiredString(rawPayload.endAt, 'payload.endAt'),
      saleOpensAt: requiredString(rawPayload.saleOpensAt, 'payload.saleOpensAt'),
      reservationCutoffAt: requiredString(
        rawPayload.reservationCutoffAt,
        'payload.reservationCutoffAt',
      ),
      prices: parsedPrices,
      pricingVersion: positiveInteger(rawPayload.pricingVersion, 'payload.pricingVersion'),
      layoutVersion: positiveInteger(rawPayload.layoutVersion, 'payload.layoutVersion'),
      seats: parsedSeats,
    },
  };
}
