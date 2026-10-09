import { Inject, Injectable } from '@nestjs/common';
import type { ShiftRepository } from '../../domain/ports/out/shift-repository.interface';
import type { StoreConfigRepository } from '../../domain/ports/out/store-config-repository.interface';
import type { DispenserRepository } from '../../domain/ports/out/dispenser-repository.interface';
import { BadRequestDomainError } from '../../domain/errors/domain-error';
import { normalizeControllerUrl } from '../../utils/controller-url';
import {
  normalizeVolumeUnit,
  galonesALitros,
  litrosAGalones,
} from '../../utils/volume-unit';

export interface CloseFusionShiftCommand {
  storeId: string;
  posNo: string;
  employeeName: string;
  actualAmount: number;
  type?: string;
}

@Injectable()
export class ShiftService {
  constructor(
    @Inject('ShiftRepository') private readonly shiftRepo: ShiftRepository,
    @Inject('StoreConfigRepository')
    private readonly storeConfigRepo: StoreConfigRepository,
    @Inject('DispenserRepository')
    private readonly dispenserRepo: DispenserRepository,
  ) {}

  async closeFusionShift(dto: CloseFusionShiftCommand) {
    let gasStationCode = dto.storeId.trim();
    if (/^\d+$/.test(gasStationCode)) {
      gasStationCode = parseInt(gasStationCode, 10).toString().padStart(3, '0');
    }

    const blocked =
      await this.storeConfigRepo.findBlockedForPendingTransactions(
        gasStationCode,
      );
    if (blocked) {
      const pendingCount = await this.dispenserRepo.countPendingSalesForPos(
        dto.posNo,
      );
      if (pendingCount > 0) {
        throw new BadRequestDomainError(
          `Existen ${pendingCount} transacciones sin facturar.`,
        );
      }
    }

    const store = await this.storeConfigRepo.findByStoreId(dto.storeId);

    let fusionApiUrl = (store?.urlControlador || '').trim();
    if (!fusionApiUrl) {
      throw new BadRequestDomainError(
        'No se configuró la URL del Controlador Fusion (campo url_controlador de la tienda).',
      );
    }
    fusionApiUrl = normalizeControllerUrl(fusionApiUrl);
    const closeType = dto.type || 'S';

    try {
      const closeRes = await fetch(`${fusionApiUrl}/api/fusion/shift-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Type: closeType }),
      });
      const closeData = (await closeRes.json()) as FusionShiftCloseResponse;
      if (
        closeData.errorCode ||
        (closeData.message &&
          String(closeData.message).toLowerCase().includes('error'))
      ) {
        throw new BadRequestDomainError(
          `Error al cerrar en Fusion: ${closeData.message || closeData.errorCode}`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestDomainError) throw err;
      throw new BadRequestDomainError(
        'Error de comunicación con Controlador Fusion al cerrar el turno.',
      );
    }

    try {
      const statusRes = await fetch(`${fusionApiUrl}/api/fusion/period-status`);
      const statusData = (await statusRes.json()) as FusionPeriodStatusResponse;
      if (statusData?.PeriodDetails?.PeriodID) {
        const periodId = String(statusData.PeriodDetails.PeriodID);
        const turnoCount =
          await this.shiftRepo.countTurnoControladorByPeriod(periodId);
        if (turnoCount === 0) {
          const detailsJson = JSON.stringify(
            statusData.PeriodDetails.AdditionalDetails ?? [],
          );
          await this.shiftRepo.createTurnoControlador({
            periodId,
            startDate: String(statusData.PeriodDetails.StartDate ?? ''),
            startTime: String(statusData.PeriodDetails.StartTime ?? ''),
            additionalDetails: detailsJson,
          });
        }
      }
    } catch (errDB) {
      console.error('Error procesando PeriodDetails:', errDB);
    }

    return { success: true };
  }

  async getAvailableShifts(
    storeId: string,
    posCode: string,
    fechaTurno: string,
  ) {
    void posCode;
    return this.shiftRepo.getAvailableShifts(storeId, fechaTurno);
  }

  async getShiftSalesReport(
    storeId: string,
    posCode: string,
    employeeName: string,
    turno: string,
    fechaTurno: string,
  ) {
    const shouldHideData =
      await this.storeConfigRepo.findHideShiftInfo(posCode);

    const { lines, payments, headers } =
      await this.shiftRepo.getSalesReportData(
        storeId,
        turno,
        employeeName,
        fechaTurno,
      );

    const num = (v: unknown) => Number(v) || 0;
    const groupSum = <T>(
      arr: T[],
      keyFn: (r: T) => string,
      valFn: (r: T) => number,
      cntFn?: (r: T) => number,
    ) => {
      const m = new Map<string, { total: number; cantidad: number }>();
      for (const r of arr) {
        const k = keyFn(r);
        const cur = m.get(k) || { total: 0, cantidad: 0 };
        cur.total += valFn(r);
        cur.cantidad += cntFn ? cntFn(r) : 0;
        m.set(k, cur);
      }
      return [...m.entries()].map(([k, v]) => ({
        name: k,
        total: v.total,
        cantidad: v.cantidad,
      }));
    };

    const fuelLines = lines.filter(
      (l) => l.numeroBomba && l.numeroBomba.trim() !== '',
    );
    const otherLines = lines.filter(
      (l) => !l.numeroBomba || l.numeroBomba.trim() === '',
    );

    // Volumen por producto: se normaliza a galones y litros usando la unidad de
    // cada línea (null → por defecto galones, según decisión del cambio).
    const volumeKey = (l: (typeof fuelLines)[number]) => l.descripcion || '';
    const volumeToGallons = (l: (typeof fuelLines)[number]) => {
      const cantidad = num(l.cantidad);
      if (normalizeVolumeUnit(l.unidadMedida) === 'LITRO') return litrosAGalones(cantidad);
      return cantidad;
    };
    const volumeToLiters = (l: (typeof fuelLines)[number]) => {
      const cantidad = num(l.cantidad);
      if (normalizeVolumeUnit(l.unidadMedida) === 'LITRO') return cantidad;
      return galonesALitros(cantidad);
    };
    const volByProduct = new Map<
      string,
      { volumenGalones: number; volumenLitros: number }
    >();
    for (const l of fuelLines) {
      const k = volumeKey(l);
      const cur = volByProduct.get(k) || { volumenGalones: 0, volumenLitros: 0 };
      cur.volumenGalones += volumeToGallons(l);
      cur.volumenLitros += volumeToLiters(l);
      volByProduct.set(k, cur);
    }
    const redondeado = (v: number) => Math.round(v * 1000) / 1000;

    // Unidad de medida por grupo: la primera no nula de sus líneas.
    const umByKey = <T extends { descripcion: string | null; unidadMedida: string | null }>(
      arr: T[],
    ) => {
      const m = new Map<string, string>();
      for (const l of arr) {
        const k = l.descripcion || '';
        if (l.unidadMedida && !m.has(k)) m.set(k, l.unidadMedida);
      }
      return m;
    };
    const umCombustible = umByKey(fuelLines);
    const umOtros = umByKey(otherLines);

    const combustibles = groupSum(
      fuelLines,
      (l) => l.descripcion || '',
      (l) => num(l.montoConIsv),
      (l) => num(l.cantidad), // volumen (gal/lts)
    ).map((g) => {
      const vol = volByProduct.get(g.name) || {
        volumenGalones: 0,
        volumenLitros: 0,
      };
      return {
        ...g,
        volumenGalones: redondeado(vol.volumenGalones),
        volumenLitros: redondeado(vol.volumenLitros),
        unidadMedida: umCombustible.get(g.name) ?? null,
      };
    });
    const otrosProductos = groupSum(
      otherLines,
      (l) => l.descripcion || '',
      (l) => num(l.montoConIsv),
      (l) => num(l.cantidad), // unidades
    ).map((g) => ({
      ...g,
      unidadMedida: umOtros.get(g.name) ?? null,
    }));
    const cobros = groupSum(
      payments,
      (p) => p.metodoPago || p.descripcion || p.codigoMetodoPago || '',
      (p) => num(p.monto),
      () => 1, // nº de cobros
    );
    const movCaja = groupSum(
      payments,
      (p) => p.metodoPago || p.descripcion || p.codigoMetodoPago || '',
      (p) => num(p.montoIngresado) || num(p.monto),
    );
    const impuestos = groupSum(
      lines,
      (l) => l.grupoIsv || '',
      (l) => num(l.montoIsv),
    );

    const dispensadores = [
      ...new Set(fuelLines.map((l) => l.numeroBomba).filter(Boolean)),
    ].map((p) => ({ PumpNo: p }));

    const totalCombustible = fuelLines.reduce(
      (a, l) => a + num(l.montoConIsv),
      0,
    );
    const totalOtrosProductos = otherLines.reduce(
      (a, l) => a + num(l.montoConIsv),
      0,
    );
    const totalVentas = headers.reduce((a, h) => a + num(h.monto), 0);
    const totalCobros = payments.reduce((a, p) => a + num(p.monto), 0);
    const totalDescuentos = lines.reduce(
      (a, l) => a + num(l.montoDescuentoLinea),
      0,
    );
    const totalEfectivo = payments
      .filter((p) => (p.descripcion || '').toUpperCase().includes('EFECTIVO'))
      .reduce((a, p) => a + num(p.monto), 0);

    const cantidadFacturas = headers.filter(
      (h) => num(h.tipoDocumento) === 1,
    ).length;
    const cantidadTicket = headers.filter(
      (h) => num(h.tipoDocumento) !== 1 && num(h.tipoDocumento) !== 3,
    ).length;
    const cantidadDevoluciones = headers.filter(
      (h) => num(h.tipoDocumento) === 3,
    ).length;

    const offlineCreditHeaders = headers.filter(
      (h) => h.origenValidacionCredito === 'OFFLINE_FALLBACK',
    );
    const totalCreditoOffline = offlineCreditHeaders.reduce(
      (a, h) => a + num(h.monto),
      0,
    );
    const cantidadCreditoOffline = offlineCreditHeaders.length;

    const tasaCambio = await this.storeConfigRepo.findExchangeRate(fechaTurno);

    const volumenGalonesTotal = redondeado(
      combustibles.reduce((a, c) => a + (c.volumenGalones || 0), 0),
    );
    const volumenLitrosTotal = redondeado(
      combustibles.reduce((a, c) => a + (c.volumenLitros || 0), 0),
    );

    return {
      shouldHideData,
      combustibles,
      otrosProductos,
      cobros,
      movCaja,
      impuestos,
      dispensadores,
      salidaLps: [],
      entradaDolar: [],
      tasaCambio,
      fechaServidor: new Date().toISOString(),
      totales: {
        totalCombustible,
        totalOtrosProductos,
        totalVentas,
        totalTicket: cantidadTicket,
        totalCobros,
        totalEfectivo,
        totalDescuentos,
        cantidadFacturas,
        cantidadTicket,
        cantidadDevoluciones,
        totalCreditoOffline,
        cantidadCreditoOffline,
        volumenGalones: volumenGalonesTotal,
        volumenLitros: volumenLitrosTotal,
      },
    };
  }

  async getShiftReclassifications(shiftId: string) {
    return this.shiftRepo.getShiftReclassifications(shiftId);
  }
}

interface FusionShiftCloseResponse {
  errorCode?: string;
  message?: string;
}

interface FusionPeriodStatusResponse {
  PeriodDetails?: {
    PeriodID?: string | number;
    StartDate?: string;
    StartTime?: string;
    AdditionalDetails?: unknown;
  };
}
