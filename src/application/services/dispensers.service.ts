import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import type {
  DispenserRepository,
  SimpleHoseConfig,
} from '../../domain/ports/out/dispenser-repository.interface';
import { NotFoundDomainError } from '../../domain/errors/domain-error';
import {
  FALLBACK_HOSES,
  buildMockPumpTransactions,
} from './dispenser-fallbacks';

export interface AuthorizePumpCommand {
  pumpId: number;
  limitAmount: number;
}

export interface LocalDispenser {
  pumpId: number;
  state: string;
  productName: string;
  gallons: number;
  amount: number;
  unitPrice: number;
  limitAmount: number | null;
  saleId?: number | null;
  pos?: string | null;
}

export interface FusionSaleRow {
  SaleID: number;
  PumpNumber: number;
  amount: number;
  ppu: number;
  volume: number;
}

export interface HoseFSRow {
  pumpId: number;
  productName: string;
  unitPrice: number;
  pos?: string | null;
}

export interface HoseFSFullRow {
  id: number;
  hoseId: number;
  gradeNumber: number;
  gradeName: string;
  pricePerUnit: number;
  pumpId: number;
  hosePhysicalId: number;
  codigoPos: string;
  esVisible: boolean;
}

export interface TransactionRow {
  SaleID: number;
  PosNumber: number;
  PumpNumber: number;
  HoseNumber: string;
  Grade: string;
  Precio: number;
  Cantidad: number;
  Estado: string;
  Amount: number;
  Ciclo: string;
  Date: string;
  Fecha: string;
  Hora: string;
  Despachador: string;
}

export interface PumpTransaction {
  saleId: number;
  posNumber: number;
  pumpNumber: number;
  hoseNumber: string;
  grade: string;
  combustible: string;
  unidad: string;
  precio: number;
  cantidad: number;
  estado: string;
  amount: number;
  ciclo: string;
  date: string;
  fecha: string;
  hora: string;
  despachador: string;
}

@Injectable()
export class DispensersService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private dispensers: Map<number, LocalDispenser> = new Map();

  constructor(
    @Inject('DispenserRepository')
    private readonly dispenserRepo: DispenserRepository,
  ) {
    // Initialize default dispensers
    this.dispensers.set(1, {
      pumpId: 1,
      state: 'idle',
      productName: 'Súper',
      gallons: 0.0,
      amount: 0.0,
      unitPrice: 30.5,
      limitAmount: null,
      saleId: null,
    });
    this.dispensers.set(2, {
      pumpId: 2,
      state: 'idle',
      productName: 'Regular',
      gallons: 0.0,
      amount: 0.0,
      unitPrice: 28.2,
      limitAmount: null,
      saleId: null,
    });
    this.dispensers.set(3, {
      pumpId: 3,
      state: 'idle',
      productName: 'Diesel',
      gallons: 0.0,
      amount: 0.0,
      unitPrice: 25.1,
      limitAmount: null,
      saleId: null,
    });
    this.dispensers.set(4, {
      pumpId: 4,
      state: 'idle',
      productName: 'Regular',
      gallons: 0.0,
      amount: 0.0,
      unitPrice: 28.2,
      limitAmount: null,
      saleId: null,
    });
  }

  async listPendingSales() {
    try {
      const sales = await this.dispenserRepo.getPendingSales();
      return sales.map((s) => ({
        SaleID: s.SaleID,
        PumpNumber: s.PumpNumber,
        amount: s.amount,
        ppu: s.ppu,
        volume: s.volume,
        GradeNr: s.GradeNr,
        IsInvoiced: s.IsInvoiced,
      }));
    } catch {
      return [];
    }
  }

  private cachedHoses: SimpleHoseConfig[] | null = null;

  async onModuleInit() {
    // Cargar la configuración de mangueras/bombas una única vez al iniciar
    await this.loadHosesConfig();

    // Start background simulation loop every 4 seconds
    this.timer = setInterval(() => {
      this.tickSimulation();
    }, 4000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async loadHosesConfig() {
    try {
      const hoses = await this.dispenserRepo.getSimpleHoseConfigs();
      if (hoses && hoses.length > 0) {
        this.cachedHoses = hoses;
      }
    } catch (err) {
      console.warn(
        'No se pudo cargar la configuración de HoseFS al iniciar:',
        err,
      );
    }
  }

  async getDispensers(): Promise<LocalDispenser[]> {
    // 1. Fetch live pending transactions from FusionSales
    const pendingSales = new Map<
      number,
      { saleId: number; amount: number; ppu: number; volume: number }
    >();
    try {
      const sales = await this.dispenserRepo.getPendingSales();
      for (const s of sales) {
        pendingSales.set(s.PumpNumber ?? 0, {
          saleId: s.SaleID,
          amount: s.amount,
          ppu: s.ppu,
          volume: s.volume,
        });
      }
    } catch {
      // Quiet fail if table does not exist or db is inaccessible
    }

    const activePumps = new Set<number>();
    const posByPump = new Map<number, string | null>();

    // 2. Fetch configurations from HoseFS to update product names/prices if available (cached permanently)
    if (!this.cachedHoses) {
      await this.loadHosesConfig();
    }
    const hoses = this.cachedHoses || [];

    try {
      for (const h of hoses) {
        activePumps.add(h.pumpId);
        posByPump.set(h.pumpId, h.pos ?? null);
        let local = this.dispensers.get(h.pumpId);
        if (!local) {
          local = {
            pumpId: h.pumpId,
            state: 'idle',
            productName: h.productName || 'Súper',
            gallons: 0.0,
            amount: 0.0,
            unitPrice: h.unitPrice || 0.0,
            limitAmount: null,
            saleId: null,
          };
          this.dispensers.set(h.pumpId, local);
        } else if (local.state === 'idle') {
          local.productName = h.productName || local.productName;
          local.unitPrice = h.unitPrice || local.unitPrice;
        }
      }
    } catch {
      // Quiet fail - fallback to hardcoded 1-4 if db fails
      activePumps.add(1);
      activePumps.add(2);
      activePumps.add(3);
      activePumps.add(4);
    }

    // If no active pumps were found in the database, also fallback to 1-4
    if (activePumps.size === 0) {
      activePumps.add(1);
      activePumps.add(2);
      activePumps.add(3);
      activePumps.add(4);
    }

    // 3. Assemble and return status, prioritizing live database sales
    const result: LocalDispenser[] = [];
    const sortedPumpIds = Array.from(activePumps).sort((a, b) => a - b);

    for (const pumpId of sortedPumpIds) {
      const local = this.dispensers.get(pumpId);
      if (!local) continue;

      const liveSale = pendingSales.get(pumpId);

      if (liveSale) {
        // If there is a live pending sale, override in-memory state to 'colgada'
        result.push({
          pumpId,
          state: 'colgada',
          productName: local.productName,
          gallons: liveSale.volume,
          amount: liveSale.amount,
          unitPrice: liveSale.ppu,
          limitAmount: null,
          saleId: liveSale.saleId,
          pos: posByPump.get(pumpId) ?? null,
        });
      } else {
        // Otherwise, return the in-memory simulated status
        result.push({ ...local, pos: posByPump.get(pumpId) ?? null });
      }
    }

    return result;
  }

  async getHoses(): Promise<HoseFSFullRow[]> {
    try {
      const hoses = await this.dispenserRepo.getHoseConfigs();
      return hoses.map((r) => ({
        id: r.id,
        hoseId: r.hoseId,
        gradeNumber: r.gradeNumber,
        gradeName: r.gradeName,
        pricePerUnit: r.pricePerUnit,
        pumpId: r.pumpId,
        hosePhysicalId: r.hosePhysicalId,
        codigoPos: r.codigoPos,
        esVisible: r.esVisible,
      }));
    } catch (err) {
      console.warn(
        'Could not query HoseFS from database, using fallback:',
        err,
      );
      return FALLBACK_HOSES;
    }
  }

  async getPumpTransactions(
    pumpId: number,
    limit?: number,
  ): Promise<PumpTransaction[]> {
    try {
      return await this.dispenserRepo.getPumpTransactions(pumpId, limit);
    } catch (err) {
      console.warn(
        `Could not fetch transactions for pump ${pumpId} from database, using mock:`,
        err,
      );
      return buildMockPumpTransactions(
        pumpId,
        this.dispensers.get(pumpId),
        new Date(),
      );
    }
  }

  authorizePump(dto: AuthorizePumpCommand) {
    const local = this.dispensers.get(dto.pumpId);

    if (!local) {
      throw new NotFoundDomainError(`Bomba con ID ${dto.pumpId} no encontrada`);
    }

    // Set simulated authorization
    local.state = 'authorized';
    local.limitAmount = dto.limitAmount || 1500.0;
    local.amount = 0.0;
    local.gallons = 0.0;

    return { success: true };
  }

  /**
   * Called when an invoice clears a pending transaction.
   */
  clearPumpSale(pumpId: number) {
    const local = this.dispensers.get(pumpId);
    if (local) {
      local.state = 'idle';
      local.amount = 0.0;
      local.gallons = 0.0;
      local.limitAmount = null;
    }
  }

  private tickSimulation() {
    for (const local of this.dispensers.values()) {
      if (local.state === 'idle') {
        // 10% chance to go to calling state
        if (Math.random() < 0.1) {
          local.state = 'calling';
          local.amount = 0.0;
          local.gallons = 0.0;
          local.limitAmount = null;
        }
      } else if (local.state === 'authorized') {
        // Progress immediately to fueling state
        local.state = 'fueling';
        local.amount = 0.0;
        local.gallons = 0.0;
      } else if (local.state === 'fueling') {
        const price = local.unitPrice;
        const limit = local.limitAmount || 1500.0;

        // Add random amount of fuel per tick
        const increment = 150.0 + Math.random() * 100.0;
        const newAmount = Math.min(local.amount + increment, limit);
        const newGallons = Number((newAmount / price).toFixed(2));
        const finalAmount = Number(newAmount.toFixed(2));

        const nextState = newAmount >= limit ? 'colgada' : 'fueling';

        local.state = nextState;
        local.amount = finalAmount;
        local.gallons = newGallons;
      }
    }
  }
}
