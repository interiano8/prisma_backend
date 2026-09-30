import * as bcrypt from 'bcrypt';

/**
 * Generates a Bcrypt password hash (cost factor 10).
 */
export function createPasswordHash(password: string): string {
  if (!password) return '';
  return bcrypt.hashSync(password, 10);
}

/**
 * Verifies a password against a Bcrypt password hash.
 */
export function verifyPasswordHash(
  hashedPassword: string,
  providedPassword: string,
): boolean {
  if (!hashedPassword || !providedPassword) return false;

  try {
    return bcrypt.compareSync(providedPassword, hashedPassword);
  } catch (error) {
    console.error('Error verifying Bcrypt hash:', error);
    return false;
  }
}
