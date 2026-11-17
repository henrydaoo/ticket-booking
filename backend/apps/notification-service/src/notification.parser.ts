import { BadRequestException } from '@nestjs/common';
import { NotificationEvent, NotificationJobInput } from './notification.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 500) {
    throw new BadRequestException(`INVALID_NOTIFICATION_EVENT:${field}`);
  }
  return value.trim();
}

export function parseNotificationEvent(value: unknown): NotificationEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('INVALID_NOTIFICATION_EVENT');
  }
  const event = value as Record<string, unknown>;
  if (event.schemaVersion !== 1) {
    throw new BadRequestException('UNSUPPORTED_NOTIFICATION_EVENT_VERSION');
  }
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw new BadRequestException('INVALID_NOTIFICATION_EVENT:payload');
  }
  const occurredAt = requiredString(event.occurredAt, 'occurredAt');
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new BadRequestException('INVALID_NOTIFICATION_EVENT:occurredAt');
  }
  return {
    eventId: requiredString(event.eventId, 'eventId'),
    eventType: requiredString(event.eventType, 'eventType'),
    schemaVersion: 1,
    aggregateType: requiredString(event.aggregateType, 'aggregateType'),
    aggregateId: requiredString(event.aggregateId, 'aggregateId'),
    occurredAt,
    correlationId: requiredString(event.correlationId, 'correlationId'),
    payload: event.payload as Record<string, unknown>,
  };
}

export function buildNotificationJobs(event: NotificationEvent) {
  const payload = event.payload;
  const recipientEmail = payload.recipientEmail;
  if (typeof recipientEmail !== 'string' || !EMAIL_PATTERN.test(recipientEmail)) {
    throw new BadRequestException('INVALID_NOTIFICATION_EVENT:recipientEmail');
  }

  const base = {
    recipientEmail,
    templateData: {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      ...payload,
    },
  };

  switch (event.eventType) {
    case 'BookingConfirmed':
      return [
        {
          ...base,
          type: 'BOOKING_CONFIRMATION' as const,
          scheduledAt: new Date(),
        },
      ];
    case 'TicketIssued': {
      const startAt = requiredString(payload.showtimeStartAt, 'payload.showtimeStartAt');
      const showtimeStartAt = new Date(startAt);
      if (!Number.isFinite(showtimeStartAt.getTime())) {
        throw new BadRequestException('INVALID_NOTIFICATION_EVENT:showtimeStartAt');
      }
      const reminderAt = new Date(showtimeStartAt.getTime() - 24 * 60 * 60 * 1000);
      const jobs: NotificationJobInput[] = [
        {
          ...base,
          type: 'TICKET_ISSUED' as const,
          scheduledAt: new Date(),
        },
      ];
      if (reminderAt.getTime() > Date.now()) {
        jobs.push({
          ...base,
          type: 'SHOWTIME_REMINDER' as const,
          scheduledAt: reminderAt,
        });
      }
      return jobs;
    }
    case 'PaymentFailed':
      return [{ ...base, type: 'PAYMENT_FAILURE' as const, scheduledAt: new Date() }];
    case 'BookingCancelled':
      return [{ ...base, type: 'BOOKING_CANCELLATION' as const, scheduledAt: new Date() }];
    case 'RefundCompleted':
      return [{ ...base, type: 'REFUND_COMPLETION' as const, scheduledAt: new Date() }];
    case 'ShowtimeCancelled':
      return [{ ...base, type: 'SHOWTIME_CANCELLATION' as const, scheduledAt: new Date() }];
    case 'ShowtimeRescheduled':
      return [{ ...base, type: 'SHOWTIME_RESCHEDULE' as const, scheduledAt: new Date() }];
    default:
      throw new BadRequestException(`UNSUPPORTED_NOTIFICATION_EVENT:${event.eventType}`);
  }
}
