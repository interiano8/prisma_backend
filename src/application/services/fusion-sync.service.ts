import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import type {
  DispenserRepository,
  FuelSaleCreateInput,
} from '../../domain/ports/out/dispenser-repository.interface';
import { connect } from 'mssql';
import type { Config, IConnectionPool } from 'mssql';

interface FusionSaleRow {
  SaleID: number;
  PosNumber: number;
  PumpNumber: number;
  HoseNumber: string;
  Amount: number;
  PPU: number;
  Volume: number;
  FinalVolumeTotal: number;
  InitialVolumeTotal: number;
  PaymentType: string | null;
  PaymentInfo: string | null;
  CompensatedTemperature: string | null;
  ShiftID: string | null;
  GradeNr: number | null;
  PriceLevel: number | null;
  TypeOfTransaction: string | null;
  DateOfTransaction: string | null;
  TimeOfTransaction: string | null;
  PresetAmount: number | null;
  PaymentAlarm: string | null;
  ATCVO: string | null;
  AVGTM: string | null;
  ATCIVO: string | null;
  ATCFVO: string | null;
  IsInvoiced: boolean;
  Date: Date | null;
}

@Injectable()
export class FusionSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FusionSyncService.name);
  private pool: IConnectionPool | null = null;
  private timer: NodeJS.Timeout | null = null;
  private reconcileTimer: NodeJS.Timeout | null = null;
  private running = false;

  public status = {
    connected: false,
    lastSyncAt: null as Date | null,
    lastInserted: 0,
    lastError: null as string | null,
  };

  constructor(
    @Inject('DispenserRepository')
    private readonly dispenserRepo: DispenserRepository,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.incrementalSync();
    }, 5000);
    this.reconcileTimer = setInterval(() => {
      void this.fullSync();
    }, 60000);
    // Conexión y primera sincronización en segundo plano (no bloquea el arranque)
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await this.connect();
    await this.fullSync();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    if (this.pool) this.pool.close().catch(() => {});
  }

  private async connect(): Promise<void> {
    const url = process.env.MSSQL_URL;
    if (!url) {
      this.logger.warn(
        'MSSQL_URL no definido; sync Fusion deshabilitado (no hay SQL Server que sincronizar).',
      );
      this.status.connected = false;
      return;
    }
    try {
      const config = this.parseMssql(url);
      this.pool = await connect(config);
      this.status.connected = true;
      this.logger.log('Sync Fusion conectado a SQL Server.');
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (JSON.stringify(e) ?? 'error desconocido');
      this.logger.error(
        `No se pudo conectar a SQL Server para sync Fusion: ${msg}`,
      );
      this.status.connected = false;
      this.status.lastError = msg;
    }
  }

  private parseMssql(url: string): Config {
    const m = url.match(/^sqlserver:\/\/([^:;]+)(?::(\d+))?;(.+)$/s);
    if (!m) throw new Error('MSSQL_URL inválida');
    const params: Record<string, string> = {};
    for (const part of m[3].split(';')) {
      const i = part.indexOf('=');
      if (i > 0)
        params[part.slice(0, i).trim().toLowerCase()] = part
          .slice(i + 1)
          .trim();
    }
    return {
      server: m[1],
      port: m[2] ? parseInt(m[2], 10) : 1433,
      user: params.user,
      password: params.password,
      database: params.database,
      options: { trustServerCertificate: true, encrypt: false },
      pool: { max: 3 },
      connectionTimeout: 15000,
      requestTimeout: 60000,
    };
  }

  private async fullSync(): Promise<void> {
    if (!this.pool || this.running) return;
    this.running = true;
    try {
      const rows = await this.readFusionSales();
      const inserted = await this.insertMissing(rows);
      this.status.lastSyncAt = new Date();
      this.status.lastInserted = inserted;
      this.status.lastError = null;
      if (inserted > 0) {
        this.logger.log(
          `Sync Fusion: ${inserted} venta(s) nueva(s) insertada(s) en Postgres.`,
        );
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (JSON.stringify(e) ?? 'error desconocido');
      this.status.lastError = msg;
      this.logger.warn(`Sync Fusion error: ${msg}`);
    } finally {
      this.running = false;
    }
  }

  private async incrementalSync(): Promise<void> {
    await this.fullSync();
  }

  private async readFusionSales(): Promise<FusionSaleRow[]> {
    const result = await this.pool!.request().query<FusionSaleRow>(`
      SELECT [SaleID], [PosNumber], [PumpNumber], [HoseNumber], [Amount], [PPU], [Volume],
             [FinalVolumeTotal], [InitialVolumeTotal], [PaymentType], [PaymentInfo],
             [CompensatedTemperature], [ShiftID], [GradeNr], [PriceLevel], [TypeOfTransaction],
             [DateOfTransaction], [TimeOfTransaction], [PresetAmount], [PaymentAlarm],
             [ATCVO], [AVGTM], [ATCIVO], [ATCFVO], [IsInvoiced], [Date]
      FROM [FusionController].[dbo].[FusionSales]`);
    return result.recordset;
  }

  private async insertMissing(rows: FusionSaleRow[]): Promise<number> {
    if (!rows || rows.length === 0) return 0;

    const existing = await this.dispenserRepo.getExistingSaleIds();
    const existingIds = new Set(existing);

    const toCreate = rows
      .filter((r) => !existingIds.has(Number(r.SaleID)))
      .map((r) => this.mapRow(r));
    if (toCreate.length === 0) return 0;

    return this.dispenserRepo.createSales(toCreate);
  }

  private mapRow(r: FusionSaleRow): FuelSaleCreateInput {
    return {
      idVenta: Number(r.SaleID),
      numeroPos: r.PosNumber != null ? Number(r.PosNumber) : null,
      numeroBomba: r.PumpNumber != null ? Number(r.PumpNumber) : null,
      numeroManguera: r.HoseNumber != null ? String(r.HoseNumber) : null,
      monto: r.Amount != null ? Number(r.Amount) : null,
      precioUnitario: r.PPU != null ? Number(r.PPU) : null,
      volumen: r.Volume != null ? Number(r.Volume) : null,
      volumenFinal:
        r.FinalVolumeTotal != null ? Number(r.FinalVolumeTotal) : null,
      volumenInicial:
        r.InitialVolumeTotal != null ? Number(r.InitialVolumeTotal) : null,
      tipoPago: r.PaymentType ?? null,
      infoPago: r.PaymentInfo ?? null,
      temperaturaCompensada: r.CompensatedTemperature ?? null,
      idTurno: r.ShiftID != null ? String(r.ShiftID) : null,
      numeroGrado: r.GradeNr != null ? Number(r.GradeNr) : null,
      nivelPrecio: r.PriceLevel != null ? Number(r.PriceLevel) : null,
      tipoTransaccion: r.TypeOfTransaction ?? null,
      fechaTransaccion: r.DateOfTransaction ?? null,
      horaTransaccion: r.TimeOfTransaction ?? null,
      montoPreestablecido:
        r.PresetAmount != null ? Number(r.PresetAmount) : null,
      alarmaPago: r.PaymentAlarm ?? null,
      atcvo: r.ATCVO ?? null,
      avgtm: r.AVGTM ?? null,
      atcivo: r.ATCIVO ?? null,
      atcfvo: r.ATCFVO ?? null,
      facturada: r.IsInvoiced === true,
      fecha: r.Date ? new Date(r.Date) : null,
    };
  }
}
