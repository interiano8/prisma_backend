export const TOKEN_PORT = 'TokenPort';

export interface TokenPayload {
  sub: number;
  username: string;
  profile: string;
}

export interface TokenPort {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
