import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
} from './permissions.catalog';

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedSystemRolesAndPermissions();
    await this.migrateExistingEmployees();
  }

  /**
   * Inicializa de forma idempotente los permisos y roles esenciales del sistema.
   */
  async seedSystemRolesAndPermissions() {
    this.logger.log('Inicializando catálogo de permisos y roles del sistema en estación...');

    // 1. Upsert Permisos
    for (const p of SYSTEM_PERMISSIONS) {
      await this.prisma.permiso.upsert({
        where: { id: p.id },
        update: {
          nombre: p.name,
          modulo: p.module,
          descripcion: p.description,
        },
        create: {
          id: p.id,
          nombre: p.name,
          modulo: p.module,
          descripcion: p.description,
        },
      });
    }

    // 2. Upsert Roles del Sistema
    for (const r of SYSTEM_ROLES) {
      await this.prisma.rol.upsert({
        where: { id: r.id },
        update: {
          nombre: r.name,
          descripcion: r.description,
          esSistema: true,
          estaActivo: true,
        },
        create: {
          id: r.id,
          nombre: r.name,
          descripcion: r.description,
          esSistema: true,
          estaActivo: true,
        },
      });

      // 3. Vincular permisos a roles del sistema
      for (const permId of r.permissions) {
        await this.prisma.rolPermiso.upsert({
          where: {
            idRol_idPermiso: {
              idRol: r.id,
              idPermiso: permId,
            },
          },
          update: {},
          create: {
            idRol: r.id,
            idPermiso: permId,
          },
        }).catch(() => {});
      }
    }

    this.logger.log('Catálogo de permisos y roles inicializado exitosamente.');
  }

  /**
   * Asocia roles equivalentes a empleados antiguos que aún no tengan registros en `EmpleadoRol`.
   */
  async migrateExistingEmployees() {
    const employeesWithoutRoles = await this.prisma.empleado.findMany({
      where: {
        roles: { none: {} },
      },
      select: { id: true, perfil: true, usuario: true },
    });

    for (const emp of employeesWithoutRoles) {
      const normalized = (emp.perfil || '').toUpperCase().trim();
      let targetRole = 'CAJERO';

      if (normalized.includes('SUPER') && normalized.includes('ADMIN')) targetRole = 'SUPER_ADMIN';
      else if (normalized.includes('ADMIN')) targetRole = 'ADMIN';
      else if (normalized.includes('SUPERV')) targetRole = 'SUPERVISOR';
      else if (normalized.includes('CAJ')) targetRole = 'CAJERO';
      else if (normalized.includes('BOMB')) targetRole = 'BOMBERO';
      else if (normalized.includes('AUDIT')) targetRole = 'AUDITOR';

      await this.prisma.empleadoRol.upsert({
        where: {
          idEmpleado_idRol: {
            idEmpleado: emp.id,
            idRol: targetRole,
          },
        },
        update: {},
        create: {
          idEmpleado: emp.id,
          idRol: targetRole,
        },
      }).catch(() => {});

      this.logger.log(`Empleado migrado a RBAC: ${emp.usuario} -> ${targetRole}`);
    }
  }

  /**
   * Resuelve los roles y la unión matemática de permisos efectivos de un empleado.
   */
  async getEmpleadoRolesAndPermissions(idEmpleado: number): Promise<{ roles: string[]; permissions: string[] }> {
    const empleadoRoles = await this.prisma.empleadoRol.findMany({
      where: { idEmpleado },
      include: {
        rol: {
          include: {
            permisos: {
              select: { idPermiso: true },
            },
          },
        },
      },
    });

    const activeRoles = empleadoRoles.filter((er) => er.rol.estaActivo);
    const roles = activeRoles.map((er) => er.rol.id);

    const permissionSet = new Set<string>();
    for (const er of activeRoles) {
      for (const p of er.rol.permisos) {
        permissionSet.add(p.idPermiso);
      }
    }

    return {
      roles,
      permissions: Array.from(permissionSet),
    };
  }

  /**
   * Asigna múltiples roles a un empleado.
   */
  async assignRolesToEmpleado(idEmpleado: number, roleIds: string[]): Promise<{ roles: string[]; permissions: string[] }> {
    const empleado = await this.prisma.empleado.findUnique({ where: { id: idEmpleado } });
    if (!empleado) {
      throw new NotFoundException(`Empleado con ID ${idEmpleado} no encontrado.`);
    }

    // Validar que todos los roles existan
    const existingRoles = await this.prisma.rol.findMany({
      where: { id: { in: roleIds } },
    });
    if (existingRoles.length !== roleIds.length) {
      throw new BadRequestException('Uno o más roles seleccionados no existen.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Eliminar asignaciones previas
      await tx.empleadoRol.deleteMany({ where: { idEmpleado } });

      // Insertar nuevas asignaciones
      for (const roleId of roleIds) {
        await tx.empleadoRol.create({
          data: { idEmpleado, idRol: roleId },
        });
      }

      // Actualizar columna legacy perfil para retrocompatibilidad
      const primaryRole = roleIds[0] || 'CAJERO';
      await tx.empleado.update({
        where: { id: idEmpleado },
        data: { perfil: primaryRole },
      });
    });

    return this.getEmpleadoRolesAndPermissions(idEmpleado);
  }

  /**
   * Crea un rol personalizado en la estación.
   */
  async createCustomRole(data: { id: string; nombre: string; descripcion?: string; permissionIds: string[] }) {
    const slug = data.id.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
    const existing = await this.prisma.rol.findUnique({ where: { id: slug } });
    if (existing) {
      throw new BadRequestException(`El rol con identificador "${slug}" ya existe.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const rol = await tx.rol.create({
        data: {
          id: slug,
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          esSistema: false,
          estaActivo: true,
        },
      });

      for (const permId of data.permissionIds) {
        await tx.rolPermiso.create({
          data: {
            idRol: rol.id,
            idPermiso: permId,
          },
        });
      }

      return rol;
    });
  }

  /**
   * Elimina un rol personalizado (impide eliminar roles del sistema).
   */
  async deleteCustomRole(roleId: string) {
    const rol = await this.prisma.rol.findUnique({ where: { id: roleId } });
    if (!rol) {
      throw new NotFoundException(`Rol "${roleId}" no encontrado.`);
    }
    if (rol.esSistema) {
      throw new BadRequestException('Los roles del sistema son inmutables y no pueden eliminarse.');
    }

    await this.prisma.rol.delete({ where: { id: roleId } });
    return { success: true, message: `Rol "${roleId}" eliminado exitosamente.` };
  }

  /**
   * Lista todos los roles con sus permisos asignados.
   */
  async listRoles() {
    return this.prisma.rol.findMany({
      include: {
        permisos: {
          select: { idPermiso: true },
        },
        _count: {
          select: { empleados: true },
        },
      },
      orderBy: [{ esSistema: 'desc' }, { nombre: 'asc' }],
    });
  }

  /**
   * Lista el catálogo completo de permisos.
   */
  async listPermissions() {
    return this.prisma.permiso.findMany({
      orderBy: [{ modulo: 'asc' }, { nombre: 'asc' }],
    });
  }
}
