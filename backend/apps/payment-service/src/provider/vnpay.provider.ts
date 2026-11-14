import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_CONFIG, PaymentConfig } from '../config';
import {
  PaymentCreation,
  PaymentProviderPort,
  PaymentCreationResult,
  PaymentQueryResult,
  RefundCreation,
  RefundCreationResult,
} from './payment-provider.port';
import { hasValidVnpaySignature, vnpaySignature } from './vnpay-signature';

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

  verifyCallback(parameters: Record<string, string>) {
    const signature = parameters.vnp_SecureHash;
    if (!signature || !hasValidVnpaySignature(parameters, signature, this.config.vnpayHashSecret)) {
      throw new Error('INVALID_WEBHOOK_SIGNATURE');
    }
    const amountRaw = parameters.vnp_Amount;
    const amount = Number(amountRaw);
    if (
      !parameters.vnp_TxnRef ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount % 100 !== 0
    ) {
      throw new Error('INVALID_WEBHOOK_PAYLOAD');
    }
    return {
      providerReference: parameters.vnp_TxnRef,
      paymentId: parameters.vnp_TxnRef,
      amountVnd: amount / 100,
      success: parameters.vnp_ResponseCode === '00' && parameters.vnp_TransactionStatus === '00',
      responseCode: parameters.vnp_ResponseCode || 'UNKNOWN',
    };
  }

  queryPayment(input: {
      paymentId: string;
      providerReference: string;
      amountVnd: number;
      transactionDate: Date;
    }): Promise<PaymentQueryResult> {
      return this.callTransactionApi({
        vnp_Command: 'querydr',
        vnp_TxnRef: input.providerReference,
        vnp_TransactionDate: this.formatDate(input.transactionDate),
        vnp_Amount: String(input.amountVnd * 100),
        vnp_OrderInfo: `Query payment ${input.paymentId}`,
        vnp_CreateDate: this.formatDate(new Date()),
        vnp_IpAddr: '127.0.0.1',
      }).then((result) => ({
        status: result.vnp_ResponseCode === '00' && result.vnp_TransactionStatus === '00'
          ? 'SUCCEEDED'
          : result.vnp_ResponseCode === '24' ? 'UNKNOWN' : 'FAILED',
        responseCode: result.vnp_ResponseCode || 'UNKNOWN',
        providerReference: input.providerReference,
      }));
  }

  createRefund(input: RefundCreation): Promise<RefundCreationResult> {
      return this.callTransactionApi({
        vnp_Command: 'refund',
        vnp_TxnRef: input.providerReference,
        vnp_TransactionType: '02',
        vnp_Amount: String(input.amountVnd * 100),
        vnp_OrderInfo: input.orderInfo,
        vnp_TransactionDate: this.formatDate(input.transactionDate),
        vnp_CreateDate: this.formatDate(new Date()),
        vnp_IpAddr: input.clientIp,
        vnp_CreateBy: input.idempotencyKey,
      }).then((result) => ({
        status: result.vnp_ResponseCode === '00' ? 'SUCCEEDED'
          : result.vnp_ResponseCode === '24' ? 'PENDING' : 'FAILED',
        responseCode: result.vnp_ResponseCode || 'UNKNOWN',
        providerReference: input.providerReference,
      }));
  }

  private async callTransactionApi(parameters: Record<string, string>): Promise<Record<string, string>> {
      const signed = {
        vnp_Version: '2.1.0',
        vnp_TmnCode: this.config.vnpayTmnCode,
        ...parameters,
      };
      const query = new URLSearchParams({
        ...signed,
        vnp_SecureHash: vnpaySignature(signed, this.config.vnpayHashSecret),
      });
      const response = await fetch(this.config.vnpayApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: query.toString(),
      });
      if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
      const text = await response.text();
      return Object.fromEntries(new URLSearchParams(text));
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
