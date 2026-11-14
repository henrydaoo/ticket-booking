export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export type PaymentResponse = {
  paymentId: string;
  bookingId: string;
  status: PaymentStatus;
  amountVnd: number;
  provider: 'VNPAY';
  paymentUrl: string;
  processingDeadlineAt: string;
};
