export interface PasswordHasherPort {
  verify(hashedPassword: string, providedPassword: string): boolean;
}
