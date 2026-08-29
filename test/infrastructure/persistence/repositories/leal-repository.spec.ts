import { LealRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/leal-repository';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

const jsonResp = (obj: unknown, status = 200, statusText = 'OK') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  text: () => Promise.resolve(JSON.stringify(obj)),
  json: () => Promise.resolve(obj),
});

const credsPrisma = {
  tienda: {
    findFirst: jest.fn().mockResolvedValue({ urlLeal: 'https://leal.app' }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  configuracionLeal: {
    findFirst: jest.fn().mockResolvedValue({
      usuario: 'user1',
      contrasena: 'pass1',
    }),
  },
};

const loginOkFetch = () => {
  (global as any).fetch = jest
    .fn()
    .mockResolvedValueOnce(
      jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
    )
    .mockResolvedValueOnce(
      jsonResp({ user: { id_comercio: 5, id_sucursal: '3', uid_cms: 'cms' } }),
    );
};

describe('LealRepositoryImpl (acceso a datos)', () => {
  afterEach(() => {
    delete (global as any).fetch;
    jest.restoreAllMocks();
  });

  describe('login', () => {
    it('lanza si faltan credenciales o URL', async () => {
      const prisma = {
        tienda: { findFirst: jest.fn().mockResolvedValue(null) },
        configuracionLeal: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const repo = new LealRepositoryImpl(prisma);

      await expect(repo.login({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('lanza si la respuesta no es JSON válido', async () => {
      (global as any).fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html>proxy error</html>'),
      });
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.login({})).rejects.toThrow(UnauthorizedException);
    });

    it('devuelve token y guarda idComercio del /me', async () => {
      loginOkFetch();
      const repo = new LealRepositoryImpl(credsPrisma as any);

      const result = await repo.login({});

      expect(result.token).toBe('T');
      expect((result as unknown as { code: number }).code).toBe(100);
      expect((global as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining('/com_usuarios/login'),
        expect.any(Object),
      );
      expect((global as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining('/com_usuarios/me'),
        expect.any(Object),
      );
    });

    it('tolera fallos del /me', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockRejectedValueOnce(new Error('network'));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      const result = await repo.login({});

      expect(result.token).toBe('T');
    });

    it('lanza Unauthorized si el código no es 100', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 401, message: 'Credenciales inválidas' }),
        );
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.login({})).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('checkStatus', () => {
    it('devuelve conectado con OTP activo', async () => {
      loginOkFetch();
      const repo = new LealRepositoryImpl(credsPrisma as any);
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(
          jsonResp({ code: 100, user: { id_comercio: 5, tiene_otp: '1' } }),
        );

      const result = await repo.checkStatus();

      expect(result).toEqual({
        connected: true,
        idComercio: 5,
        tieneOtp: true,
      });
    });

    it('devuelve no conectado si el código no es 100', async () => {
      loginOkFetch();
      const repo = new LealRepositoryImpl(credsPrisma as any);
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 500 }));

      await expect(repo.checkStatus()).resolves.toEqual({
        connected: false,
      });
    });

    it('devuelve no conectado si la red falla', async () => {
      loginOkFetch();
      const repo = new LealRepositoryImpl(credsPrisma as any);
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(repo.checkStatus()).resolves.toEqual({
        connected: false,
      });
    });
  });

  describe('generateOtp', () => {
    it('genera OTP con idPremio y datos cacheados', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({
            user: { id_comercio: 5, id_sucursal: '3', uid_cms: 'cms' },
          }),
        )
        .mockResolvedValueOnce(
          jsonResp({ code: 100, mensaje: 'otp generado' }),
        );
      const repo = new LealRepositoryImpl(credsPrisma as any);

      const result = await repo.generateOtp('U1', 7);

      expect(result.code).toBe(100);
      const otpCall = (global as any).fetch.mock.calls[2];
      expect(otpCall[0]).toContain('generarOTPRedencion');
      expect(JSON.parse(otpCall[1].body)).toMatchObject({
        uid: 'U1',
        id_comercio: 5,
        id_sucursal: '3',
        id_premio: 7,
      });
    });

    it('lanza BadRequest si Leal rechaza', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 400, mensaje: 'sin premio' }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.generateOtp('U1', 7)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('searchCustomer', () => {
    it('mapea el usuario con soloCedula=s', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(
          jsonResp({
            code: 100,
            user: {
              uid: 'U1',
              cedula: '0801',
              nombre: 'Juan',
              apellido: 'Perez',
              email: 'j@x.com',
              celular: '555',
              puntos_activos: '42',
              estado: '1',
              tier: 'gold',
            },
          }),
        );
      const repo = new LealRepositoryImpl(credsPrisma as any);

      const result = await repo.searchCustomer('0801', 's', 'T');

      expect(result).toMatchObject({
        uid: 'U1',
        documentId: '0801',
        nombre: 'Juan',
        apellido: 'Perez',
        puntos: 42,
        tier: 'gold',
      });
      expect((global as any).fetch.mock.calls[2][0]).toContain('soloCedula=s');
    });

    it('devuelve null si no hay usuario o código no es 100', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 200, data: {} }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.searchCustomer('0801', 'n', 'T')).resolves.toBeNull();
    });
  });

  describe('getPremios', () => {
    it('devuelve premios anidados en data', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(
          jsonResp({ code: 100, data: { premios: [{ id: 1 }] } }),
        );
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).resolves.toEqual([{ id: 1 }]);
    });

    it('devuelve vacío si no hay premios o código no es 100', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 100, data: { otros: 1 } }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).resolves.toEqual([]);
    });
  });

  describe('accumulatePoints', () => {
    it('acumula puntos y envía el PIN recortado', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 100, puntos: 8 }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      const result = await repo.accumulatePoints({
        customerId: 'U1',
        invoiceNo: 'F1',
        total: 100,
        token: '',
        pin: '  1234  ',
        totales: { SubTotal: 90, ImpuestoTotal: 10, FormaPago: 'EFECTIVO' },
      });

      expect(result.puntos).toBe(8);
      const call = (global as any).fetch.mock.calls[2];
      const body = JSON.parse(call[1].body);
      expect(body.pin).toBe('1234');
      expect(body.transaccion.clave).toBe('F1');
      expect(body.totalAcum).toBe(100);
    });

    it('lanza BadRequest si el código no es 100', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 400, mensaje: 'rechazado' }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(
        repo.accumulatePoints({
          customerId: 'U1',
          invoiceNo: 'F1',
          total: 100,
          token: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('redeemPoints', () => {
    it('redime puntos con OTP y nota', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(
          jsonResp({ code: 100, id_transaccion: 'LEAL-1' }),
        );
      const repo = new LealRepositoryImpl(credsPrisma as any);

      const result = await repo.redeemPoints({
        customerId: 'U1',
        points: 10,
        invoiceNo: 'F1',
        token: '',
        otp: '1234',
        nota: 'Redencion',
      });

      expect(result.id_transaccion).toBe('LEAL-1');
      const call = (global as any).fetch.mock.calls[2];
      const body = JSON.parse(call[1].body);
      expect(body).toMatchObject({
        uid: 'U1',
        valor: 10,
        factura: 'F1',
        OTP: '1234',
        nota: 'Redencion',
        id_comercio: 5,
      });
    });
  });

  describe('executeWithAuth', () => {
    it('hace refresh y reintenta ante HTTP 401', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({}, 401, 'Unauthorized'))
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T2', refresh_token: 'R2' }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 100, data: {} }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).resolves.toEqual([]);

      expect((global as any).fetch.mock.calls[3][0]).toContain(
        '/com_usuarios/refresh',
      );
    });

    it('lanza InternalServer si el status no es ok', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({}, 500, 'Server Error'));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('hace login si el refresh falla ante HTTP 401', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({}, 401, 'Unauthorized'))
        .mockResolvedValueOnce(jsonResp({ code: 500 }))
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T3', refresh_token: 'R3' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 100, data: {} }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).resolves.toEqual([]);
    });

    it('lanza Unauthorized si el 401 persiste tras reintentar', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({}, 401, 'Unauthorized'))
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T2', refresh_token: 'R2' }),
        )
        .mockResolvedValueOnce(jsonResp({}, 401, 'Unauthorized'));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('reintenta ante respuesta code 120', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 120 }))
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T2', refresh_token: 'R2' }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 100, data: {} }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).resolves.toEqual([]);
    });

    it('hace login si el refresh falla ante code 120', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 120 }))
        .mockResolvedValueOnce(jsonResp({ code: 500 }))
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T3', refresh_token: 'R3' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce(jsonResp({ code: 100, data: {} }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).resolves.toEqual([]);
    });

    it('devuelve vacío si el código no es 100', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(jsonResp({ user: { id_comercio: 5 } }))
        .mockResolvedValueOnce(jsonResp({ code: 500 }));
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).resolves.toEqual([]);
    });

    it('lanza InternalServer si la API devuelve HTML', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () => Promise.resolve('<html>oops</html>'),
        });
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('traduce timeout a InternalServer', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 100, token: 'T', refresh_token: 'R' }),
        )
        .mockResolvedValueOnce(
          jsonResp({ user: { id_comercio: 5, id_sucursal: '3' } }),
        )
        .mockRejectedValueOnce(
          Object.assign(new Error('fetch timed out'), {
            name: 'AbortError',
          }),
        );
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(repo.getPremios('U1', 'T')).rejects.toThrow(
        'Tiempo de espera agotado',
      );
    });
  });

  describe('reverseTransaction', () => {
    it('rechaza explícitamente mientras no exista el endpoint de Leal', async () => {
      const repo = new LealRepositoryImpl(credsPrisma as any);

      await expect(
        repo.reverseTransaction('TR-1', 'FAC-1', 'TOKEN'),
      ).rejects.toThrow('Reversión en Leal no implementada');
    });
  });

  describe('credenciales cifradas', () => {
    it('decifra credenciales almacenadas con prefijo aes:', async () => {
      const key = Buffer.from('~F9Q0Fmer?y0ritm', 'utf8');
      const iv = Buffer.from('~F9Q0Fmer?y0ritm', 'utf8');
      const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
      let enc = cipher.update('secretUser', 'utf8', 'base64');
      enc += cipher.final('base64');
      const prisma = {
        tienda: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ urlLeal: 'https://leal.app' }),
        },
        configuracionLeal: {
          findFirst: jest.fn().mockResolvedValue({
            usuario: `aes:${enc}`,
            contrasena: 'aes:plain',
          }),
        },
      } as any;
      const repo = new LealRepositoryImpl(prisma);

      const creds = await repo.getCredentials();

      expect(creds.user).toBe('secretUser');
    });

    it('updateCredentials actualiza configuración existente y habilita Leal', async () => {
      const update = jest.fn().mockResolvedValue({});
      const prisma = {
        tienda: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ urlLeal: 'https://leal.app' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        configuracionLeal: {
          findFirst: jest.fn().mockResolvedValue({ id: 1 }),
          update,
        },
      } as any;
      loginOkFetch();
      const repo = new LealRepositoryImpl(prisma);

      await repo.updateCredentials('user1', 'pass1');

      expect(update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          usuario: expect.stringContaining('aes:'),
        }),
      });
      expect(prisma.tienda.updateMany).toHaveBeenCalledWith({
        data: { lealHabilitado: true },
      });
    });

    it('updateCredentials lanza BadRequest si el login falla', async () => {
      const prisma = {
        tienda: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ urlLeal: 'https://leal.app' }),
        },
        configuracionLeal: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
      } as any;
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResp({ code: 401, message: 'malas credenciales' }),
        );
      const repo = new LealRepositoryImpl(prisma);

      await expect(repo.updateCredentials('user1', 'pass1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updateCredentials envuelve errores de base en InternalServer', async () => {
      const prisma = {
        tienda: { findFirst: jest.fn().mockResolvedValue(null) },
        configuracionLeal: {
          findFirst: jest.fn().mockRejectedValue(new Error('db down')),
        },
      } as any;
      const repo = new LealRepositoryImpl(prisma);

      await expect(repo.updateCredentials('user1', 'pass1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('guardar credenciales usa el formato aes:iv:data con IV aleatorio', async () => {
      const update = jest.fn().mockResolvedValue({});
      const prisma = {
        tienda: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ urlLeal: 'https://leal.app' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        configuracionLeal: {
          findFirst: jest.fn().mockResolvedValue({ id: 1 }),
          update,
        },
      } as any;
      loginOkFetch();
      const repo = new LealRepositoryImpl(prisma);

      await repo.updateCredentials('user1', 'pass1');

      const stored = update.mock.calls[0][0].data;
      expect(stored.usuario).toMatch(/^aes:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
      expect(stored.contrasena).toMatch(
        /^aes:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/,
      );
    });

    it('decifra credenciales con formato aes:iv:data (IV aleatorio por mensaje)', () => {
      const repo = new LealRepositoryImpl({} as any);
      const iv = crypto.randomBytes(16);
      const key = Buffer.from('~F9Q0Fmer?y0ritm', 'utf8');
      const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
      let enc = cipher.update('userLeal', 'utf8', 'base64');
      enc += cipher.final('base64');
      const stored = `aes:${iv.toString('base64')}:${enc}`;

      const decrypted = (repo as any).decryptAes(stored);

      expect(decrypted).toBe('userLeal');
    });

    it('usa LEAL_AES_KEY del entorno para cifrar y descifrar', () => {
      const envKey = 'LealEnvClave1234';
      process.env.LEAL_AES_KEY = envKey;
      const repo = new LealRepositoryImpl({} as any);
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(envKey, 'utf8');
      const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
      let enc = cipher.update('conEnv', 'utf8', 'base64');
      enc += cipher.final('base64');

      const decrypted = (repo as any).decryptAes(
        `aes:${iv.toString('base64')}:${enc}`,
      );

      expect(decrypted).toBe('conEnv');
      delete process.env.LEAL_AES_KEY;
    });

    it('deriva la clave a 16 bytes si LEAL_AES_KEY no mide 16', () => {
      const envKey = 'clave-demasiado-larga-para-aes-128';
      process.env.LEAL_AES_KEY = envKey;
      const repo = new LealRepositoryImpl({} as any);
      const iv = crypto.randomBytes(16);
      const derivedKey = crypto
        .createHash('sha256')
        .update(Buffer.from(envKey, 'utf8'))
        .digest()
        .subarray(0, 16);
      const cipher = crypto.createCipheriv('aes-128-cbc', derivedKey, iv);
      let enc = cipher.update('conClaveLarga', 'utf8', 'base64');
      enc += cipher.final('base64');

      const decrypted = (repo as any).decryptAes(
        `aes:${iv.toString('base64')}:${enc}`,
      );

      expect(decrypted).toBe('conClaveLarga');
      delete process.env.LEAL_AES_KEY;
    });

    it('no cifra cadenas vacías y deja sin prefijo las no cifradas', () => {
      const repo = new LealRepositoryImpl({} as any);
      expect((repo as any).encryptAes('')).toBe('');
      expect((repo as any).decryptAes('textoPlano')).toBe('textoPlano');
    });
  });

  describe('extractUser', () => {
    it('devuelve el primer usuario cuando data.user es arreglo', () => {
      const repo = new LealRepositoryImpl({} as any);
      const user = (repo as any).extractUser({
        user: [{ uid: 'u1' }, { uid: 'u2' }],
      });
      expect(user).toEqual({ uid: 'u1' });
    });

    it('devuelve data.user directo cuando es objeto', () => {
      const repo = new LealRepositoryImpl({} as any);
      const user = (repo as any).extractUser({ user: { uid: 'u1' } });
      expect(user).toEqual({ uid: 'u1' });
    });

    it('devuelve undefined si no hay user ni data', () => {
      const repo = new LealRepositoryImpl({} as any);
      expect((repo as any).extractUser({})).toBeUndefined();
    });

    it('devuelve el primer elemento cuando data.data es arreglo', () => {
      const repo = new LealRepositoryImpl({} as any);
      const user = (repo as any).extractUser({
        data: [{ uid: 'u1' }, { uid: 'u2' }],
      });
      expect(user).toEqual({ uid: 'u1' });
    });

    it('devuelve data.data.user si existe', () => {
      const repo = new LealRepositoryImpl({} as any);
      const user = (repo as any).extractUser({
        data: { user: { uid: 'u1' } },
      });
      expect(user).toEqual({ uid: 'u1' });
    });

    it('devuelve data.data directo cuando no tiene user', () => {
      const repo = new LealRepositoryImpl({} as any);
      const user = (repo as any).extractUser({ data: { uid: 'u1' } });
      expect(user).toEqual({ uid: 'u1' });
    });
  });

  describe('refreshToken', () => {
    it('devuelve false sin refresh token o sin URL', async () => {
      const repo = new LealRepositoryImpl({} as any);
      await expect((repo as any).refreshToken()).resolves.toBe(false);
    });

    it('devuelve false si el refresh falla en red', async () => {
      const repo = new LealRepositoryImpl({} as any);
      (repo as any).cachedRefreshToken = 'R';
      (repo as any).cachedUrlLeal = 'https://leal.app';
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('net'));

      await expect((repo as any).refreshToken()).resolves.toBe(false);
    });

    it('devuelve true cuando el refresh devuelve code 100 y token', async () => {
      const repo = new LealRepositoryImpl({} as any);
      (repo as any).cachedRefreshToken = 'R';
      (repo as any).cachedUrlLeal = 'https://leal.app';
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue(jsonResp({ code: 100, token: 'NEW' }));

      await expect((repo as any).refreshToken()).resolves.toBe(true);
      expect((repo as any).cachedToken).toBe('NEW');
    });

    it('devuelve false si el refresh no trae token', async () => {
      const repo = new LealRepositoryImpl({} as any);
      (repo as any).cachedRefreshToken = 'R';
      (repo as any).cachedUrlLeal = 'https://leal.app';
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue(jsonResp({ code: 500 }));

      await expect((repo as any).refreshToken()).resolves.toBe(false);
    });
  });

  describe('getStoreIdFallback', () => {
    it('devuelve el idTienda de la tienda', async () => {
      const repo = new LealRepositoryImpl({
        tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '007' }) },
      } as any);
      await expect((repo as any).getStoreIdFallback()).resolves.toBe('007');
    });

    it('devuelve 001 si no hay tienda', async () => {
      const repo = new LealRepositoryImpl({
        tienda: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any);
      await expect((repo as any).getStoreIdFallback()).resolves.toBe('001');
    });
  });

  describe('fallback de idComercio', () => {
    const repoWithCache = (prisma: any) => {
      const repo = new LealRepositoryImpl(prisma);
      (repo as any).cachedUrlLeal = 'https://leal.app';
      (repo as any).cachedUserLeal = 'u';
      (repo as any).cachedPassLeal = 'p';
      (repo as any).cachedToken = 'T';
      return repo;
    };

    it('searchCustomer usa getStoreIdFallback sin idComercio cacheado', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue(
          jsonResp({ code: 100, user: { uid: 'u1', cedula: '0801' } }),
        );
      const repo = repoWithCache({
        tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '007' }) },
      });

      const customer = await repo.searchCustomer('0801', 's', 'T');

      expect(customer?.uid).toBe('u1');
      expect((global as any).fetch.mock.calls[0][0]).toContain('/007/0801');
    });

    it('generateOtp usa getStoreIdFallback sin idComercio cacheado', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue(jsonResp({ code: 100 }));
      const repo = repoWithCache({
        tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '007' }) },
      });

      await repo.generateOtp('U1');

      const call = (global as any).fetch.mock.calls[0];
      expect(JSON.parse(call[1].body).id_comercio).toBe(7);
    });

    it('accumulatePoints usa getStoreIdFallback sin idComercio cacheado', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue(jsonResp({ code: 100, puntos: 1 }));
      const repo = repoWithCache({
        tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '007' }) },
      });

      await repo.accumulatePoints({
        customerId: 'U1',
        invoiceNo: 'F1',
        total: 100,
        token: '',
      });

      expect((global as any).fetch.mock.calls[0][0]).toContain('/007');
    });

    it('redeemPoints usa getStoreIdFallback sin idComercio cacheado', async () => {
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue(jsonResp({ code: 100 }));
      const repo = repoWithCache({
        tienda: { findFirst: jest.fn().mockResolvedValue({ idTienda: '007' }) },
      });

      await repo.redeemPoints({
        customerId: 'U1',
        points: 10,
        invoiceNo: 'F1',
        token: '',
      });

      const call = (global as any).fetch.mock.calls[0];
      expect(JSON.parse(call[1].body).id_comercio).toBe(7);
    });
  });
});
