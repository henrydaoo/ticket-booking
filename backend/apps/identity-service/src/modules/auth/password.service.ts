import { promisify } from 'node:util';
import { randomBytes, timingSafeEqual, scrypt as callbackScrypt } from 'node:crypto';

const scrypt = promisify(callbackScrypt);
const KEY_LENGTH = 64;

export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = Buffer.from(
      (await scrypt(password, salt, KEY_LENGTH)) as Uint8Array,
    );

    return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [, encodedSalt, encodedKey] = encodedHash.split('$');

    if (!encodedSalt || !encodedKey) {
      return false;
    }

    const salt = Buffer.from(encodedSalt, 'base64url');
    const expectedKey = Buffer.from(encodedKey, 'base64url');
    const actualKey = Buffer.from(
      (await scrypt(password, salt, expectedKey.length)) as Uint8Array,
    );

    return (
      actualKey.length === expectedKey.length &&
      timingSafeEqual(actualKey, expectedKey)
    );
  }
}
