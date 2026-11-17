export type NotificationType =
  | 'BOOKING_CONFIRMATION'
  | 'PAYMENT_FAILURE'
  | 'TICKET_ISSUED'
  | 'SHOWTIME_REMINDER'
  | 'BOOKING_CANCELLATION'
  | 'REFUND_COMPLETION'
  | 'SHOWTIME_CANCELLATION'
  | 'SHOWTIME_RESCHEDULE';

export type NotificationEvent = {
  eventId: string;
  eventType: string;
  schemaVersion: 1;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  payload: Record<string, unknown>;
};

export type NotificationJobInput = {
  type: NotificationType;
  recipientEmail: string;
  scheduledAt: Date;
  templateData: Record<string, unknown>;
};

export type ClaimedNotificationJob = {
  id: string;
  type: NotificationType;
  recipientEmail: string;
  templateData: Record<string, unknown>;
  correlationId: string;
  attemptCount: number;
};
