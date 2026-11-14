import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_CONFIG, PaymentConfig } from '../config';
import { PaymentCreation, PaymentProviderPort, PaymentCreationResult } from './payment-provider.port';
import { vnpaySignature } from './vnpay-signature';

@Injectable()
export class VnpayProvider implements PaymentProviderPort {
  constructor(@Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig) {}

  async createPayment(input: PaymentCreation): Promise<PaymentCreationResult> {
    const providerReference = input.paymentId;
    const parameters: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.vnpayTmnCode,
      vnp_Amount: String(input.amountVnd * 100),
      vnp_CreateDate: this.formatDate(input.createdAt),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: input.clientIp,
      vnp_Locale: 'vn',
      vnp_OrderInfo: input.orderInfo,
      vnp_ReturnUrl: input.returnUrl,
      vnp_TxnRef: providerReference,
      vnp_IpnUrl: input.ipnUrl,
    };
    const query = new URLSearchParams({
      ...parameters,
      vnp_SecureHashType: 'HmacSHA512',
      vnp_SecureHash: vnpaySignature(parameters, this.config.vnpayHashSecret),
    });
    return {
      providerReference,
      paymentUrl: `${this.config.vnpayPaymentUrl}?${query.toString()}`,
    };
  }

  verifyCallback(_parameters: Record<string, string>): never {
    throw new Error('VNPay callback processing is deferred to R2.5');
  }

  private formatDate(value: Date): string {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
  }
}
