export interface ReclassificationAuditItem {
  id: string;
  idVenta: string;
  idTurno: string;
  versionTurno: number;
  idUsuarioSolicita: string;
  idUsuarioAutoriza: string;
  tipoCambio: string; // 'FORMA_PAGO' | 'CLIENTE_CONTADO' | 'AMBOS'
  datosOriginales: any;
  datosNuevos: any;
  motivo: string;
  createdAt: Date;
}

export interface ReclassifySaleInput {
  saleId: string; // idTransaccionPos or correlativo/id
  storeId: string;
  posNo: string;
  adminPin: string;
  supervisorUser?: string;
  requestedByUser: string;
  motivo: string;
  // Forma de pago reclasificada (opcional si solo cambia cliente)
  nuevoMetodoPago?: {
    codigoMetodoPago: string;
    descripcion?: string;
    referencia?: string;
  };
  // Cliente reclasificado (opcional si solo cambia pago)
  nuevoCliente?: {
    codigo: string;
    nombre: string;
    rtn?: string;
  };
}

export interface ReclassifySaleResult {
  success: boolean;
  ventaId: string;
  turnoId: string;
  versionTurno: number;
  mensaje: string;
  totalesTurnoActualizados: {
    importeContado: number;
    detallePagos: Record<string, any>;
  };
}
