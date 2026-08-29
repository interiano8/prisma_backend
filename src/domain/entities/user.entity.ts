export interface User {
  id: number;
  username: string;
  name: string;
  profile: string;
  isActive: boolean;
  passwordHash?: string;
  codigoRfid?: string;
  pinLeal?: string;
  preferencias?: { theme?: string; accent?: string } | null;
}
