import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * Responsabilidad única: cifrado/descifrado AES-128-CBC de credenciales Leal.
 * Formato: `aes:<iv base64>:<payload base64>` (o legacy `aes:<payload>` con IV=key).
 */
export class LealCrypto {
  private readonly logger = new Logger(LealCrypto.name);

  private get aesKey(): Buffer {
    const configured = process.env.LEAL_AES_KEY;
    const bytes = Buffer.from(configured ?? '~F9Q0Fmer?y0ritm', 'utf8');
    if (bytes.length === 16) return bytes;
    return createHash('sha256').update(bytes).digest().subarray(0, 16);
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext || !ciphertext.startsWith('aes:')) return ciphertext;
    try {
      const payload = ciphertext.substring(4);
      const key = this.aesKey;
      let iv: Buffer;
      let data: string;
      const separator = payload.indexOf(':');
      if (separator !== -1) {
        iv = Buffer.from(payload.substring(0, separator), 'base64');
        data = payload.substring(separator + 1);
      } else {
        iv = key;
        data = payload;
      }
      const decipher = createDecipheriv('aes-128-cbc', key, iv);
      let decrypted = decipher.update(data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      this.logger.error('Failed to decrypt AES string', e);
      return ciphertext;
    }
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    try {
      const key = this.aesKey;
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-128-cbc', key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      return `aes:${iv.toString('base64')}:${encrypted}`;
    } catch (e) {
      this.logger.error('Failed to encrypt AES string', e);
      return plaintext;
    }
  }
}