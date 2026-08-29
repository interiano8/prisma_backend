import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pgPool: Pool;

  constructor() {
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      idleTimeoutMillis: 0,
      max: 10,
      // El adapter PrismaPg serializa las fechas en UTC sin offset; si la sesión
      // no está en UTC, Postgres las interpreta en la zona local y los filtros de
      // rango quedan corridos. Fijamos la sesión a UTC para que coincidan.
      onConnect: (client) => {
        client.query("SET TIME ZONE 'UTC'").catch(() => undefined);
      },
    });
    super({
      adapter: new PrismaPg(pgPool),
    });
    this.pgPool = pgPool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pgPool.end();
  }
}
