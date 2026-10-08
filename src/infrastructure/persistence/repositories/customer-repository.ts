import { Injectable } from '@nestjs/common';
import type { Cliente, Prisma } from '../../../../src/generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CustomerRepository } from '../../../domain/ports/out/customer-repository.interface';
import { Customer } from '../../../domain/entities/customer.entity';

@Injectable()
export class CustomerRepositoryImpl implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query?: string,
    creditOnly?: boolean,
    page?: number,
    pageSize?: number,
  ): Promise<
    | Customer[]
    | { total: number; page: number; pageSize: number; data: Customer[] }
  > {
    const where: Prisma.ClienteWhereInput = {};
    if (creditOnly) {
      where.tipoFacturacion = 0;
    }
    const q = query?.trim() ?? '';
    if (q) {
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { nombre: { contains: q, mode: 'insensitive' } },
        { rtn: { contains: q, mode: 'insensitive' } },
      ];
    }
    const pageNum = page && page > 0 ? page : undefined;
    const pageSizeNum = pageSize && pageSize > 0 ? pageSize : 100;
    const total = pageNum ? await this.prisma.cliente.count({ where }) : undefined;
    const pagination: { skip?: number; take: number } = pageNum
      ? { skip: (pageNum - 1) * pageSizeNum, take: pageSizeNum }
      : { take: 100 };
    const rows = await this.prisma.cliente.findMany({
      where,
      orderBy: { fechaActualizacion: 'desc' },
      ...pagination,
    });
    const data = rows.map((r) => this.mapCustomer(r));
    if (pageNum) {
      return { total: total ?? 0, page: pageNum, pageSize: pageSizeNum, data };
    }
    return data;
  }

  async findByCode(code: string): Promise<Customer | null> {
    const row = await this.prisma.cliente.findUnique({
      where: { codigo: code },
    });
    return row ? this.mapCustomer(row) : null;
  }

  async findByRtn(rtn: string): Promise<Customer | null> {
    const row = await this.prisma.cliente.findFirst({ where: { rtn } });
    if (!row) return null;
    return this.mapCustomer(row);
  }

  async createCustomer(
    code: string,
    name: string,
    rtn: string,
  ): Promise<{ success: boolean; code: string; name: string; rtf: string }> {
    await this.prisma.cliente.upsert({
      where: { codigo: code },
      update: { nombre: name, rtn, fechaActualizacion: new Date() },
      create: {
        codigo: code,
        nombre: name,
        rtn,
        tipoFacturacion: 1,
        fechaActualizacion: new Date(),
      },
    });
    return { success: true, code, name, rtf: rtn };
  }

  async updateBalance(code: string, delta: number): Promise<void> {
    try {
      await this.prisma.cliente.update({
        where: { codigo: code },
        data: {
          saldo: { increment: delta },
          fechaActualizacion: new Date(),
        },
      });
    } catch {
      // Best-effort local update
    }
  }

  async refreshCustomerData(
    code: string,
    data: { balance?: number; creditLimit?: number; blocked?: boolean },
  ): Promise<void> {
    try {
      const updatePayload: any = { fechaActualizacion: new Date() };
      if (data.balance !== undefined) updatePayload.saldo = data.balance;
      if (data.creditLimit !== undefined) updatePayload.limiteCredito = data.creditLimit;
      if (data.blocked !== undefined) updatePayload.bloqueado = data.blocked;

      await this.prisma.cliente.update({
        where: { codigo: code },
        data: updatePayload,
      });
    } catch {
      // Best-effort local update
    }
  }

  async getConsumidorFinalCode(): Promise<string | null> {
    const store = await this.prisma.tienda.findFirst();
    return store?.codigoConsumidorFinal || null;
  }

  private mapCustomer(row: Cliente): Customer {
    const r = row as any;
    return {
      code: row.codigo,
      name: row.nombre || '',
      rtf: row.rtn || '',
      phone: row.telefono || '',
      email: row.correo || '',
      address: row.direccion || '',
      blocked: row.bloqueado === true,
      billingType: row.tipoFacturacion ?? undefined,
      dateUpdate: row.fechaActualizacion
        ? row.fechaActualizacion.toISOString()
        : undefined,
      creditLimit: row.limiteCredito != null ? Number(row.limiteCredito) : undefined,
      creditDays: row.diasCredito != null ? Number(row.diasCredito) : undefined,
      blockOnOverdue: row.bloqueoMora === true,
      balance: row.saldo != null ? Number(row.saldo) : 0,
      hasOverdueInvoices: row.tieneFacturasVencidas === true,
    };
  }
}
