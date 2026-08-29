import * as crypto from 'crypto';

/**
 * Verifies a password or RFID code hashed using ASP.NET Identity V3 format (PBKDF2 with HMAC-SHA256).
 *
 * Hash structure:
 * - [0] format marker (0x01)
 * - [1-4] PRF (HMAC-SHA256 = 1)
 * - [5-8] iterations (typically 100,000)
 * - [9-12] salt size (typically 16 bytes)
 * - [13-16] subkey size (typically 32 bytes)
 * - [17..] salt bytes + subkey bytes
 */
export function verifyPasswordHash(
  hashedPassword: string,
  providedPassword: string,
): boolean {
  if (!hashedPassword || !providedPassword) return false;

  try {
    const buffer = Buffer.from(hashedPassword, 'base64');
    if (buffer.length < 17) return false;
    if (buffer[0] !== 0x01) return false; // Format marker

    const prf = buffer.readInt32BE(1);
    if (prf !== 1) return false; // PRF must be HMAC-SHA256

    const iterations = buffer.readInt32BE(5);
    const saltLength = buffer.readInt32BE(9);
    const subkeyLength = buffer.readInt32BE(13);

    if (iterations < 1 || saltLength < 1 || subkeyLength < 1) return false;
    if (buffer.length < 17 + saltLength + subkeyLength) return false;

    const salt = buffer.subarray(17, 17 + saltLength);
    const expectedSubkey = buffer.subarray(
      17 + saltLength,
      17 + saltLength + subkeyLength,
    );

    const actualSubkey = crypto.pbkdf2Sync(
      providedPassword,
      salt,
      iterations,
      subkeyLength,
      'sha256',
    );

    return crypto.timingSafeEqual(actualSubkey, expectedSubkey);
  } catch (error) {
    console.error('Error verifying ASP.NET Identity V3 hash:', error);
    return false;
  }
}
