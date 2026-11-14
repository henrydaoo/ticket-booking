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

export interface PaymentProviderPort {
  createPayment(input: PaymentCreation): Promise<PaymentCreationResult>;
  verifyCallback(parameters: Record<string, string>): VerifiedPaymentCallback;
}
