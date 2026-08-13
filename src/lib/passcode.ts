import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

/**
 * Hashes a passcode for storage. Format: "scrypt:<saltHex>:<hashHex>".
 */
export function hashPasscode(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEY_LENGTH);
  return `${SCRYPT_PREFIX}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verifies a submitted passcode against a stored value. Accepts legacy
 * plaintext values (no "scrypt:" prefix) so pre-existing databases keep
 * working until the passcode is next changed, at which point it is
 * re-hashed automatically by the Settings PUT route.
 */
export function verifyPasscode(plain: string, stored: string): boolean {
  if (!stored) return false;
  if (!stored.startsWith(`${SCRYPT_PREFIX}:`)) {
    // Legacy plaintext value.
    return plain === stored;
  }
  const [, saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(plain, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
