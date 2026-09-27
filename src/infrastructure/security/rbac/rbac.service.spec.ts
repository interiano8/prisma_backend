import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RbacService } from './rbac.service';

describe('RbacService (prisma_backend)', () => {
  let service: RbacService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      permiso: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      rol: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rolPermiso: {
        upsert: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      empleadoRol: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      empleado: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    service = new RbacService(prismaMock);
  });

  describe('getEmpleadoRolesAndPermissions', () => {
    it('retorna los roles y la unión de permisos sin duplicados', async () => {
      prismaMock.empleadoRol.findMany.mockResolvedValueOnce([
        {
          rol: {
            id: 'CAJERO',
            estaActivo: true,
            permisos: [
              { idPermiso: 'sales:create' },
              { idPermiso: 'sales:reprint' },
            ],
          },
        },
        {
          rol: {
            id: 'SUPERVISOR',
            estaActivo: true,
            permisos: [
              { idPermiso: 'sales:create' }, // Duplicado intencional
              { idPermiso: 'sales:cancel' },
              { idPermiso: 'shifts:close' },
            ],
          },
        },
      ]);

      const result = await service.getEmpleadoRolesAndPermissions(1);

      expect(result.roles).toEqual(['CAJERO', 'SUPERVISOR']);
      expect(result.permissions.sort()).toEqual([
        'sales:cancel',
        'sales:create',
        'sales:reprint',
        'shifts:close',
      ]);
    });
  });

  describe('deleteCustomRole', () => {
    it('rechaza la eliminación si el rol pertenece al sistema', async () => {
      prismaMock.rol.findUnique.mockResolvedValueOnce({
        id: 'ADMIN',
        nombre: 'Administrador',
        esSistema: true,
      });

      await expect(service.deleteCustomRole('ADMIN')).rejects.toThrow(BadRequestException);
    });

    it('permite eliminar un rol personalizado no perteneciente al sistema', async () => {
      prismaMock.rol.findUnique.mockResolvedValueOnce({
        id: 'CUSTOM_AUDITOR',
        nombre: 'Auditor Externo',
        esSistema: false,
      });

      const result = await service.deleteCustomRole('CUSTOM_AUDITOR');
      expect(result.success).toBe(true);
      expect(prismaMock.rol.delete).toHaveBeenCalledWith({ where: { id: 'CUSTOM_AUDITOR' } });
    });
  });

  describe('assignRolesToEmpleado', () => {
    it('asigna múltiples roles y actualiza el rol primario en perfil de Empleado', async () => {
      prismaMock.empleado.findUnique.mockResolvedValueOnce({ id: 1, usuario: 'carlos' });
      prismaMock.rol.findMany.mockResolvedValueOnce([
        { id: 'CAJERO' },
        { id: 'SUPERVISOR' },
      ]);
      jest.spyOn(service, 'getEmpleadoRolesAndPermissions').mockResolvedValueOnce({
        roles: ['CAJERO', 'SUPERVISOR'],
        permissions: ['sales:create', 'shifts:close'],
      });

      const result = await service.assignRolesToEmpleado(1, ['CAJERO', 'SUPERVISOR']);

      expect(prismaMock.empleadoRol.deleteMany).toHaveBeenCalledWith({ where: { idEmpleado: 1 } });
      expect(prismaMock.empleadoRol.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.empleado.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { perfil: 'CAJERO' },
      });
      expect(result.roles).toContain('CAJERO');
      expect(result.roles).toContain('SUPERVISOR');
    });

    it('lanza NotFoundException si el empleado no existe', async () => {
      prismaMock.empleado.findUnique.mockResolvedValueOnce(null);

      await expect(service.assignRolesToEmpleado(999, ['CAJERO'])).rejects.toThrow(NotFoundException);
    });
  });
});
