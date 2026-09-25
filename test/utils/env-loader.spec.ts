import { loadEnv } from '../../src/utils/env-loader';

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

import * as fs from 'fs';

const ENV_PLAIN = 'PORT=3001\n# comentario\nDB=postgres\nSECRET_KEY=abc123\n';

describe('loadEnv', () => {
  const existsSyncMock = fs.existsSync as jest.Mock;
  const readFileSyncMock = fs.readFileSync as jest.Mock;

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.DB;
    delete process.env.SECRET_KEY;
    existsSyncMock.mockReset().mockReturnValue(false);
    readFileSyncMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('carga .env en texto plano', () => {
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.env'));
    readFileSyncMock.mockReturnValue(ENV_PLAIN);

    loadEnv();

    expect(process.env.PORT).toBe('3001');
    expect(process.env.DB).toBe('postgres');
    expect(process.env.SECRET_KEY).toBe('abc123');
  });

  it('no sobreescribe variables ya definidas', () => {
    process.env.PORT = '9999';
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.env'));
    readFileSyncMock.mockReturnValue(ENV_PLAIN);

    loadEnv();

    expect(process.env.PORT).toBe('9999');
  });

  it('no hace nada si no existe .env', () => {
    existsSyncMock.mockReturnValue(false);

    loadEnv();

    expect(process.env.PORT).toBeUndefined();
  });
});