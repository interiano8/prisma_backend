export interface PasswordHasherPort {
  verify(hashedPassword: string, providedPassword: string): boolean;
  hash(password: string): string;
}