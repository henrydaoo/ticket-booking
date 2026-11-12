import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TIME_STEP_SECONDS = 30;
const CODE_DIGITS = 6;

function base32Encode(value: Buffer): string {
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(value: string): Buffer {
  const normalized = value.replace(/[\s=-]/g, '').toUpperCase();
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error('Invalid base32 secret');
    }

    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function codeForCounter(secret: string, counter: number): string {
  const digest = createHmac('sha1', base32Decode(secret))
    .update(Buffer.from(counter.toString(16).padStart(16, '0'), 'hex'))
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binary =
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);

  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, '0');
}

@Injectable()
export class TotpService {
  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  buildOtpAuthUri(secret: string, email: string, issuer: string): string {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  generateCode(secret: string, at = Date.now()): string {
    const counter = Math.floor(at / 1000 / TIME_STEP_SECONDS);
    return codeForCounter(secret, counter);
  }

  verifyCode(secret: string, code: string, at = Date.now()): boolean {
    if (!/^\d{6}$/.test(code)) {
      return false;
    }

    const counter = Math.floor(at / 1000 / TIME_STEP_SECONDS);
    return [-1, 0, 1].some((offset) => codeForCounter(secret, counter + offset) === code);
  }

  generateRecoveryCodes(count = 8): string[] {
    return Array.from({ length: count }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
  }
}
