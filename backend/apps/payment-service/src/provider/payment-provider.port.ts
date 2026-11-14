export type PaymentCreation = {
  paymentId: string;
  amountVnd: number;
  orderInfo: string;
  returnUrl: string;
  ipnUrl: string;
  clientIp: string;
  createdAt: Date;
};

export type PaymentCreationResult = {
  paymentUrl: string;
  providerReference: string;
};

export type VerifiedPaymentCallback = {
  providerReference: string;
  paymentId: string;
  amountVnd: number;
  success: boolean;
  responseCode: string;
};

export type PaymentProviderStatus = 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

export type PaymentQueryResult = {
  status: PaymentProviderStatus;
  responseCode: string;
  providerReference: string;
};

export type RefundCreation = {
  paymentId: string;
  providerReference: string;
  amountVnd: number;
  idempotencyKey: string;
  orderInfo: string;
  transactionDate: Date;
  clientIp: string;
};

export type RefundCreationResult = {
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  providerReference: string;
  responseCode: string;
};

export interface PaymentProviderPort {
  createPayment(input: PaymentCreation): Promise<PaymentCreationResult>;
  verifyCallback(parameters: Record<string, string>): VerifiedPaymentCallback;
  queryPayment(input: {
    paymentId: string;
    providerReference: string;
    amountVnd: number;
    transactionDate: Date;
  }): Promise<PaymentQueryResult>;
  createRefund(input: RefundCreation): Promise<RefundCreationResult>;
}
