import { createHmac, timingSafeEqual } from 'node:crypto';

export function vnpaySigningData(parameters: Record<string, string>): string {
  return Object.keys(parameters)
    .filter((key) => key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`)
    .join('&');
}

export function vnpaySignature(parameters: Record<string, string>, secret: string): string {
  return createHmac('sha512', secret)
    .update(vnpaySigningData(parameters), 'utf8')
    .digest('hex')
    .toUpperCase();
}

export function hasValidVnpaySignature(
  parameters: Record<string, string>,
  providedSignature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(vnpaySignature(parameters, secret), 'utf8');
  const actual = Buffer.from(providedSignature.toUpperCase(), 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
