import { Injectable } from '@nestjs/common';
import { verifyPasswordHash } from './hash-utils';
import type { PasswordHasherPort } from '../../domain/ports/out/password-hasher.interface';

@Injectable()
export class IdentityPasswordHasher implements PasswordHasherPort {
  verify(hashedPassword: string, providedPassword: string): boolean {
    return verifyPasswordHash(hashedPassword, providedPassword);
  }
}
