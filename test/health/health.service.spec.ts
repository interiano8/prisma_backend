import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from '../../src/infrastructure/web/controllers/health.service';
import { HealthController } from '../../src/infrastructure/web/controllers/health.controller';
import { PrismaService } from '../../src/prisma/prisma.service';
import { HttpStatus } from '@nestjs/common';
import * as licensingModule from '../../src/infrastructure/licensing/license';

describe('HealthService & HealthController', () => {
  let service: HealthService;
  let controller: HealthController;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ 1: 1 }]),
      tienda: {
        findFirst: jest.fn().mockResolvedValue({
          urlControlador: 'http://localhost:5008',
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Database Health', () => {
    it('debe reportar UP cuando la base de datos responde', async () => {
      const res = await service.checkDatabase();
      expect(res.status).toBe('up');
      expect(typeof res.latencyMs).toBe('number');
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
    });

    it('debe reportar DOWN cuando la consulta de base de datos falla', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
        new Error('Connection terminated unexpectedly'),
      );
      const res = await service.checkDatabase();
      expect(res.status).toBe('down');
      expect(res.error).toContain('Connection terminated');
      expect(typeof res.latencyMs).toBe('number');
    });
  });

  describe('Controller Health', () => {
    it('debe reportar not_configured si no hay URL configurada', async () => {
      mockPrisma.tienda.findFirst.mockResolvedValueOnce(null);
      delete process.env.WAYNE_API_URL;

      const res = await service.checkController();
      expect(res.status).toBe('not_configured');
    });

    it('debe reportar UP cuando el controlador responde OK', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as any);

      try {
        const res = await service.checkController();
        expect(res.status).toBe('up');
        expect(res.url).toBe('http://localhost:5008');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('debe reportar DOWN cuando el controlador arroja error o timeout', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5008'));

      try {
        const res = await service.checkController();
        expect(res.status).toBe('down');
        expect(res.error).toBe('ECONNREFUSED 127.0.0.1:5008');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Licensing Health', () => {
    it('debe reportar bypassed si WAYNE_SKIP_LICENSE es true fuera de producción', () => {
      process.env.WAYNE_SKIP_LICENSE = 'true';
      process.env.NODE_ENV = 'test';

      const res = service.checkLicensing();
      expect(res.status).toBe('bypassed');
    });

    it('debe reportar active cuando la licencia es válida', () => {
      delete process.env.WAYNE_SKIP_LICENSE;
      jest.spyOn(licensingModule, 'validateLicense').mockReturnValueOnce({
        ok: true,
        machineId: 'test-machine',
        error: '',
      });

      const res = service.checkLicensing();
      expect(res.status).toBe('active');
      expect(res.details?.machineId).toBe('test-machine');
    });

    it('debe reportar unlicensed cuando la licencia es inválida', () => {
      delete process.env.WAYNE_SKIP_LICENSE;
      jest.spyOn(licensingModule, 'validateLicense').mockReturnValueOnce({
        ok: false,
        machineId: 'test-machine',
        error: 'Licencia vencida o ausente',
      });

      const res = service.checkLicensing();
      expect(res.status).toBe('unlicensed');
      expect(res.error).toBe('Licencia vencida o ausente');
    });
  });

  describe('Overall System Health & Controller', () => {
    it('debe retornar OK (200) cuando DB y servicios críticos están operativos', async () => {
      jest.spyOn(service, 'checkDatabase').mockResolvedValueOnce({
        status: 'up',
        latencyMs: 5,
      });
      jest.spyOn(service, 'checkController').mockResolvedValueOnce({
        status: 'up',
        latencyMs: 12,
      });
      jest.spyOn(service, 'checkLicensing').mockReturnValueOnce({
        status: 'active',
      });

      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getHealth(mockRes);
      expect(result.status).toBe('ok');
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('debe retornar DEGRADED (200) si DB está UP pero controlador está DOWN', async () => {
      jest.spyOn(service, 'checkDatabase').mockResolvedValueOnce({
        status: 'up',
        latencyMs: 5,
      });
      jest.spyOn(service, 'checkController').mockResolvedValueOnce({
        status: 'down',
        error: 'Timeout',
      });
      jest.spyOn(service, 'checkLicensing').mockReturnValueOnce({
        status: 'active',
      });

      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getHealth(mockRes);
      expect(result.status).toBe('degraded');
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('debe retornar ERROR (503) cuando la base de datos está DOWN', async () => {
      jest.spyOn(service, 'checkDatabase').mockResolvedValueOnce({
        status: 'down',
        error: 'DB down',
      });

      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getHealth(mockRes);
      expect(result.status).toBe('error');
      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });
});
