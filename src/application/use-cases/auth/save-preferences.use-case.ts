import { Injectable } from '@nestjs/common';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';

@Injectable()
export class SavePreferencesUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(
    username: string,
    preferences: { theme?: string; accent?: string },
  ) {
    await this.authRepository.savePreferences(username, preferences);
    return { success: true };
  }
}
