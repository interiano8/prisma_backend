import { InvoiceQueryRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/invoice-query-repository';
import { InvoiceRepositoryImpl } from '../../../../src/infrastructure/persistence/repositories/invoice-repository';

describe('InvoiceRepositoryImpl (lecturas)', () => {
  it('getInvoiceLines mapea las líneas a nombres originales', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        numeroVenta: 'P1',
        descripcion: 'SUPER',
        cantidad: 10,
        precioUnitarioConIsv: 30,
        montoDescuentoUnitario: 0,
        descuento: 0,
        montoDescuentoLinea: 0,
        isv: 15,
        montoIsv: 39.13,
        montoConIsv: 300,
        numeroBomba: '1',
        posicionBomba: 'A',
        numeroTanque: 'T1',
        codigoCategoria: 'COMB',
        generaAsientoBomba: true,
        grupoIsv: 'ISV_15',
        idVenta: '123',
      },
    ]);
    const repo = new InvoiceQueryRepositoryImpl({ lineaVenta: { findMany } } as any);

    const lines = await repo.getInvoiceLines('TX1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idTransaccionPos: 'TX1' } }),
    );
    expect(lines[0]['POS Sales No_']).toBe('P1');
    expect(lines[0].Description).toBe('SUPER');
    expect(lines[0].Quantity).toBe(10);
  });

  it('getInvoicePayments mapea los pagos', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        codigoMetodoPago: '1002',
        monto: 300,
        montoIngresado: 300,
        descripcion: 'EFECTIVO',
        datosAdicionales: null,
        tasaCambio: 1,
        esTicket: false,
      },
    ]);
    const repo = new InvoiceQueryRepositoryImpl({
      pagoVenta: { findMany },
      metodoPago: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { codigo: '1002', descripcion: 'EFECTIVO', categoria: 'EFECTIVO' },
          ]),
      },
    } as any);

    const payments = await repo.getInvoicePayments('TX1');

    expect(payments[0]['Charge Method Code']).toBe('1002');
    expect(payments[0].Amount).toBe(300);
    expect(payments[0].MetodoPago).toBe('EFECTIVO');
    expect(payments[0].Categoria).toBe('EFECTIVO');
  });

  it('getInvoiceLealTransactions mapea Tipo/Puntos', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ tipo: 1, puntos: 50, puntosActivos: 40 }]);
    const repo = new InvoiceQueryRepositoryImpl({ ventaLeal: { findMany } } as any);

    const txs = await repo.getInvoiceLealTransactions('TX1');

    expect(txs[0]).toEqual({ Tipo: 1, Puntos: 50, PuntosActivos: 40 });
  });

  it('getInvoiceLines mapea generaAsientoBomba false a 0', async () => {
    const repo = new InvoiceQueryRepositoryImpl({
      lineaVenta: {
        findMany: jest.fn().mockResolvedValue([
          {
            numeroVenta: 'P',
            descripcion: 'X',
            cantidad: 1,
            generaAsientoBomba: false,
          },
        ]),
      },
    } as any);

    const lines = await repo.getInvoiceLines('TX1');
    expect(lines[0]['Gen_ Pump Ledg_ Entry']).toBe(0);
  });

  it('getInvoicePayments mapea esTicket true a 1', async () => {
    const repo = new InvoiceQueryRepositoryImpl({
      pagoVenta: {
        findMany: jest.fn().mockResolvedValue([
          {
            codigoMetodoPago: '1002',
            monto: 1,
            montoIngresado: 1,
            descripcion: 'x',
            datosAdicionales: null,
            tasaCambio: 1,
            esTicket: true,
          },
        ]),
      },
      metodoPago: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { codigo: '1002', descripcion: 'EFECTIVO', categoria: 'EFECTIVO' },
          ]),
      },
    } as any);

    const payments = await repo.getInvoicePayments('TX1');
    expect(payments[0].EsTicket).toBe(1);
  });

  it('getReasons mapea los motivos', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ id: 1, motivo: 'Error de caja' }]);
    const repo = new InvoiceQueryRepositoryImpl({ motivo: { findMany } } as any);

    const reasons = await repo.getReasons();

    expect(reasons[0]).toEqual({ Id_motivo: 1, motivo: 'Error de caja' });
  });

  it('getOriginalDocument mapea el encabezado', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      tipoDocumento: 1,
      codigoCliente: 'C1',
      monto: 300,
      rtnCliente: 'RTN',
      nombreCliente: 'Cliente',
      tipoFacturacion: 1,
      subtotal: 260,
      kilometraje: '100',
      orden: 'O1',
      placaOrden: 'P1',
      chofer: 'Ch',
      cambio: 0,
    });
    const repo = new InvoiceQueryRepositoryImpl({ venta: { findFirst } } as any);

    const doc = await repo.getOriginalDocument('FAC-1', 'TX1');

    expect(doc['POS Sales Doc_ Type']).toBe(1);
    expect(doc['Cust_ Name']).toBe('Cliente');
  });

  it('checkExistingReversion devuelve true si hay reversión', async () => {
    const ventaFindFirst = jest
      .fn()
      .mockResolvedValue({ numeroDocumento: 'FAC-1' });
    const repo = new InvoiceQueryRepositoryImpl({
      venta: { findFirst: ventaFindFirst },
    } as any);

    await expect(repo.checkExistingReversion('FAC-1', 'TX1')).resolves.toBe(
      true,
    );
  });

  it('findStoreConfigField lee el JSON de configuracion_tienda', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      idTienda: '001',
      config: { printerPath: '192.168.1.1:9100' },
    });
    const repo = new InvoiceQueryRepositoryImpl({
      configuracionTienda: { findUnique },
    } as any);

    const value = await repo.findStoreConfigField('001', 'printerPath');

    expect(value).toBe('192.168.1.1:9100');
  });

  describe('correlativos', () => {
    it('findNextCorrelative calcula FV y TR desde la serie', async () => {
      const findFirst = jest
        .fn()
        .mockResolvedValueOnce({ ultimoNumeroUsado: 'FV0000000000000001' })
        .mockResolvedValueOnce({ ultimoNumeroUsado: 'TR0000000000000001' });
      const repo = new InvoiceQueryRepositoryImpl({
        serieDocumento: { findFirst },
      } as any);

      const result = await repo.findNextCorrelative('001', 'POS01');

      expect(result.invoiceNo).toBe('FV00000000000000002');
      expect(result.posTransactionId).toBe('TR000000000000002');
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ codigoSerie: 'FV-HN' }),
        }),
      );
    });

    it('findNextCorrelative lanza error claro cuando no hay serie', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        serieDocumento: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any);

      await expect(repo.findNextCorrelative('001', 'POS01')).rejects.toThrow(
        /FV-HN.*predecir/,
      );
    });

    it('findNextCreditNoteCorrelative devuelve el siguiente correlativo', async () => {
      const now = new Date();
      const vence = new Date(now.getTime() + 5 * 86400000 + 3600000);
      const repo = new InvoiceQueryRepositoryImpl({
        serieDocumento: {
          findFirst: jest.fn().mockResolvedValue({
            codigoSerie: 'NC-HN',
            numeroFin: 'NC0000000000001000',
            ultimoNumeroUsado: 'NC0000000000000001',
            fechaVenceRango: vence,
          }),
        },
      } as any);

      const result = await repo.findNextCreditNoteCorrelative('001', 'POS01');

      expect(result.serieCode).toBe('NC-HN');
      expect(result.remainingInvoices).toBe(999);
      expect(result.remainingDays).toBe(5);
      expect(result.nextInvoice).toBe('NC00000000000000002');
    });

    it('findNextCreditNoteCorrelative lanza sin rango configurado', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        serieDocumento: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any);

      await expect(
        repo.findNextCreditNoteCorrelative('001', 'POS01'),
      ).rejects.toThrow('No se encontró un rango configurado');
    });

    it('findNextCreditNoteCorrelative lanza sin correlativos disponibles', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        serieDocumento: {
          findFirst: jest.fn().mockResolvedValue({
            codigoSerie: 'NC-HN',
            numeroFin: 'NC0000000000000001',
            ultimoNumeroUsado: 'NC0000000000000001',
            fechaVenceRango: null,
          }),
        },
      } as any);

      await expect(
        repo.findNextCreditNoteCorrelative('001', 'POS01'),
      ).rejects.toThrow('No hay correlativos disponibles');
    });

    it('findNextCreditNoteCorrelative lanza si el rango venció', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        serieDocumento: {
          findFirst: jest.fn().mockResolvedValue({
            codigoSerie: 'NC-HN',
            numeroFin: 'NC0000000000001000',
            ultimoNumeroUsado: 'NC0000000000000001',
            fechaVenceRango: new Date(Date.now() - 86400000),
          }),
        },
      } as any);

      await expect(
        repo.findNextCreditNoteCorrelative('001', 'POS01'),
      ).rejects.toThrow('ha vencido');
    });
  });

  describe('validateCorrelative', () => {
    it('devuelve inválido si no hay rango', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        $transaction: jest
          .fn()
          .mockResolvedValue({ invSeries: null, trSeries: null }),
      } as any);

      const result = await repo.validateCorrelative('001', 'POS01', false);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('FV-HN');
    });

    it('devuelve inválido si el rango venció o se agotó (sin rango válido)', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        $transaction: jest
          .fn()
          .mockResolvedValue({ invSeries: null, trSeries: null }),
      } as any);

      const result = await repo.validateCorrelative('001', 'POS01', false);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('abierto y válido');
    });

    it('devuelve inválido si se agotaron los correlativos', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        $transaction: jest
          .fn()
          .mockResolvedValue({ invSeries: null, trSeries: null }),
      } as any);

      const result = await repo.validateCorrelative('001', 'POS01', true);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('TK-HN');
    });

    it('devuelve inválido si no hay serie TR-ID', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        $transaction: jest.fn().mockResolvedValue({
          invSeries: { remaining: 999, remainingDays: 5 },
          trSeries: null,
        }),
      } as any);

      const result = await repo.validateCorrelative('001', 'POS01', false);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('TR-ID');
    });

    it('devuelve válido cuando todo cuadra', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        $transaction: jest.fn().mockResolvedValue({
          invSeries: { remaining: 999, remainingDays: 5 },
          trSeries: { ultimoNumeroUsado: 'TR0000000000000001' },
        }),
      } as any);

      const result = await repo.validateCorrelative('001', 'POS01', false);

      expect(result).toEqual({
        isValid: true,
        message: 'Correlativo válido.',
        remaining: 999,
        remainingDays: 5,
      });
    });
  });

  describe('turnos', () => {
    it('getShiftDetails usa el empleado para buscar el turno', async () => {
      const findFirst = jest.fn().mockResolvedValue({
        inicioTurno: new Date('2026-08-15T08:00:00Z'),
        nombreEmpleado: 'DB Emp',
      });
      const repo = new InvoiceQueryRepositoryImpl({ turno: { findFirst } } as any);

      const result = await repo.getShiftDetails('001', 'POS01', '1', 'John');

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nombreEmpleado: 'John' }),
        }),
      );
      expect(result.employeeName).toBe('DB Emp');
    });

    it('getShiftDetails cae al turno por número si no hay empleado', async () => {
      const findFirst = jest.fn().mockResolvedValue({
        inicioTurno: new Date('2026-08-15T08:00:00Z'),
        nombreEmpleado: null,
      });
      const repo = new InvoiceQueryRepositoryImpl({ turno: { findFirst } } as any);

      const result = await repo.getShiftDetails('001', 'POS01', '1');

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ turno: '1' }),
        }),
      );
      expect(result.employeeName).toBe('SISTEMA');
    });

    it('getShiftDetails lanza si no encuentra turno', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        turno: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any);

      await expect(
        repo.getShiftDetails('001', 'POS01', '1', 'John'),
      ).rejects.toThrow('No se encontró un turno abierto');
    });

    it('getOpenShiftForEmployee mapea y devuelve null si no hay', async () => {
      const findFirst = jest
        .fn()
        .mockResolvedValueOnce({
          inicioTurno: new Date(),
          nombreEmpleado: 'John',
          turno: '2',
          idTransaccionPos: 'TX1',
        })
        .mockResolvedValueOnce(null);
      const repo = new InvoiceQueryRepositoryImpl({ turno: { findFirst } } as any);

      await expect(
        repo.getOpenShiftForEmployee('001', 'John'),
      ).resolves.toMatchObject({ Shift: '2', EmployeeName: 'John' });
      await expect(
        repo.getOpenShiftForEmployee('001', 'John'),
      ).resolves.toBeNull();
    });
  });

  describe('executeInvoiceInsert', () => {
    const invSeries = {
      codigoSerie: 'FV-HN',
      numeroLinea: 1,
      ultimoNumeroUsado: 'FV0000000000000001',
      cai: 'CAI-1',
      numeroInicio: '0001',
      numeroFin: '9999',
      fechaVenceRango: new Date('2027-01-01'),
      idTienda: '001',
      codigoPos: 'POS01',
    };
    const trSeries = {
      codigoSerie: 'TR-ID',
      numeroLinea: 1,
      ultimoNumeroUsado: 'TR0000000000000001',
      idTienda: '001',
      codigoPos: 'POS01',
    };

    const buildPrisma = () => {
      const tx = {
        $queryRaw: jest.fn(),
        tienda: { findFirst: jest.fn().mockResolvedValue({ emisor: 'PRISMA' }) },
        serieDocumento: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({ numeroInicio: 'IN', cai: null }),
        },
        venta: { create: jest.fn().mockResolvedValue({}) },
        lineaVenta: { create: jest.fn().mockResolvedValue({}) },
        pagoVenta: { create: jest.fn().mockResolvedValue({}) },
        registroTransaccion: { create: jest.fn().mockResolvedValue({}) },
        reglaDescuento: { findMany: jest.fn().mockResolvedValue([]) },
        lineaVentaDescuentoAplicado: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      return {
        prisma: {
          $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
        },
        tx,
      };
    };

    it('inserta venta, líneas, pagos y actualiza series', async () => {
      const { prisma, tx } = buildPrisma();
      tx.$queryRaw
        .mockResolvedValueOnce([invSeries])
        .mockResolvedValueOnce([trSeries]);
      const repo = new InvoiceRepositoryImpl(prisma as any);

      const result = await repo.executeInvoiceInsert({
storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        shiftDate: new Date(),
        shiftNumber: '1',
        shiftId: 'TX-123',
        customerNo: 'C1',
        customerName: 'Cliente',
        customerRtn: '',
        total: 200,
        tax: 30,
        discount: 0,
        isTicket: false,
        isCredit: false,
        comment: '',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        lines: [
          {
            lineNo: 10,
            itemCode: 'P1',
            description: 'Producto',
            quantity: 2,
            unitPrice: 100,
            discount: 0,
            vatPercent: 15,
            vatAmount: 30,
            amountIncludingVAT: 200,
            montoGravado: 170,
            pumpNo: '',
            pumpPositionNo: '',
            tankNo: '',
            itemCategoryCode: '',
            genPumpLedgEntry: 0,
            vatProdPostingGroup: '',
          },
        ],
        payments: [
          {
            chargeLineNo: 10,
            code: 'CASH',
            amount: 200,
            reference: '',
            description: 'EFECTIVO',
          },
        ],
      });

      expect(tx.venta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numeroDocumento: 'FV00000000000000002',
          tipoDocumento: 1,
          tipoFacturacion: 1,
          numeroEmisor: 'PRISMA',
          idTurno: 'TX-123',
          numeroTurno: '1',
        }),
      });
      expect(tx.lineaVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ numeroVenta: 'P1' }),
      });
      expect(tx.pagoVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ codigoMetodoPago: 'CASH' }),
      });
      expect(tx.registroTransaccion.create).toHaveBeenCalled();
      // 2 updates de series (FV + TR) + 1 cierre por fecha en lockSeriesForUpdate
      expect(tx.serieDocumento.updateMany).toHaveBeenCalledTimes(3);
      expect(tx.reglaDescuento.findMany).toHaveBeenCalledWith({
        where: {
          activo: true,
          AND: [
            {
              OR: [
                { fechaInicio: null },
                { fechaInicio: { lte: expect.any(Date) } },
              ],
            },
            { OR: [{ fechaFin: null }, { fechaFin: { gte: expect.any(Date) } }] },
            { OR: [{ codigoCliente: 'C1' }, { codigoCliente: null }] },
            { OR: [{ codigoProducto: 'P1' }, { codigoProducto: null }] },
            { OR: [{ codigoCategoria: '' }, { codigoCategoria: null }] },
          ],
        },
      });
      expect(result[0]).toMatchObject({
        NextInvoiceOfNextInvoice: 'FV00000000000000002',
        CAIOfNextInvoice: 'CAI-1',
      });
    });

    it('usa serie TK-HN y tipoDocumento 4 para ticket (aunque isCredit)', async () => {
      const { prisma, tx } = buildPrisma();
      tx.$queryRaw
        .mockResolvedValueOnce([{ ...invSeries, codigoSerie: 'TK-HN' }])
        .mockResolvedValueOnce([trSeries]);
      const repo = new InvoiceRepositoryImpl(prisma as any);

      await repo.executeInvoiceInsert({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        shiftDate: new Date(),
        shiftNumber: '1',
        customerNo: '',
        customerName: '',
        customerRtn: '',
        total: 100,
        tax: 0,
        discount: 0,
        isTicket: true,
        isCredit: true,
        comment: '',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        lines: [],
        payments: [],
      });

      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.venta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipoDocumento: 4 }),
      });
    });

    it('computa montos con líneas/pagos nulos, pagos USD y crédito', async () => {
      const { prisma, tx } = buildPrisma();
      tx.$queryRaw
        .mockResolvedValueOnce([invSeries])
        .mockResolvedValueOnce([trSeries]);
      const repo = new InvoiceRepositoryImpl(prisma as any);

      await repo.executeInvoiceInsert({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        shiftDate: new Date(),
        shiftNumber: '1',
        customerNo: 'C1',
        customerName: 'Cliente',
        customerRtn: '',
        total: 10,
        tax: 0,
        discount: 5,
        isTicket: false,
        isCredit: true,
        comment: '',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        lines: [
          {
            lineNo: 2,
            itemCode: 'P2',
            description: 'Prod2',
            quantity: undefined,
            unitPrice: 10,
            vatPercent: undefined,
            vatAmount: undefined,
            amountIncludingVAT: undefined,
            montoGravado: undefined,
            discount: 5,
            pumpNo: undefined,
            pumpPositionNo: undefined,
            tankNo: undefined,
            itemCategoryCode: undefined,
            genPumpLedgEntry: 1,
            vatProdPostingGroup: undefined,
          },
        ] as any,
        payments: [
          { code: 'USD', amount: 4, moneda: 'USD', tasaCambio: 25 },
          { code: 'CASH', amount: undefined, moneda: 'HNL' },
          { code: 'USD0', amount: 5, moneda: 'USD', tasaCambio: 0 },
        ] as any,
      });

      expect(tx.venta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipoDocumento: 2,
          tipoFacturacion: 0,
          monto: 0,
          subtotal: 0,
          cambio: 105,
          numeroLinea: 1,
        }),
      });
      expect(tx.lineaVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numeroVenta: 'P2',
          cantidad: 0,
          precioUnitarioConIsv: 10,
          montoDescuentoUnitario: 0,
          numeroBomba: '',
          posicionBomba: '',
          numeroTanque: '',
          codigoCategoria: '',
          grupoIsv: '',
          generaAsientoBomba: true,
          montoGravado: 0,
        }),
      });
      expect(tx.pagoVenta.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          numeroLineaPago: 0,
          codigoMetodoPago: 'USD',
          monto: 100,
          numeroTarjeta: '',
          descripcion: '',
          tasaCambio: 25,
          montoIngresado: 4,
        }),
      });
      expect(tx.pagoVenta.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          codigoMetodoPago: 'CASH',
          monto: 0,
          tasaCambio: 1,
          montoIngresado: 0,
        }),
      });
      expect(tx.pagoVenta.create).toHaveBeenNthCalledWith(3, {
        data: expect.objectContaining({
          codigoMetodoPago: 'USD0',
          monto: 5,
          tasaCambio: 1,
          montoIngresado: 5,
        }),
      });
    });

    it('aplica la regla ganadora en la línea', async () => {
      const { prisma, tx } = buildPrisma();
      tx.$queryRaw
        .mockResolvedValueOnce([invSeries])
        .mockResolvedValueOnce([trSeries]);
      tx.reglaDescuento.findMany.mockResolvedValue([
        {
          id: 'R1',
          tipoBeneficio: 'PORCENTAJE',
          valor: 10,
          prioridad: 5,
          cantidadMinima: 1,
          codigoCliente: null,
          codigoProducto: null,
          codigoCategoria: null,
          fechaInicio: null,
          fechaFin: null,
          unidadVolumen: null,
        },
      ]);
      const repo = new InvoiceRepositoryImpl(prisma as any);

      await repo.executeInvoiceInsert({
        storeId: '001',
        posNo: '1',
        employeeName: 'John',
        shiftDate: new Date(),
        shiftNumber: '1',
        customerNo: 'C1',
        customerName: 'Cliente',
        customerRtn: '',
        total: 200,
        tax: 0,
        discount: 0,
        isTicket: false,
        isCredit: false,
        comment: '',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        lines: [
          {
            lineNo: 1,
            itemCode: 'P1',
            description: 'P',
            quantity: 2,
            unitPrice: 100,
            vatPercent: 0,
            vatAmount: 0,
            amountIncludingVAT: 200,
            montoGravado: 200,
            discount: 0,
            pumpNo: '',
            pumpPositionNo: '',
            tankNo: '',
            itemCategoryCode: '',
            genPumpLedgEntry: 0,
            vatProdPostingGroup: '',
            saleId: 5,
          },
        ],
        payments: [
          {
            code: 'CASH',
            amount: 200,
            chargeLineNo: 1,
            reference: '',
            description: 'EFECTIVO',
          },
        ],
      });

      expect(tx.lineaVentaDescuentoAplicado.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ idRegla: 'R1', montoAplicado: 20 }),
      });
      expect(tx.lineaVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          montoDescuentoUnitario: 10,
          descuento: 20,
          montoDescuentoLinea: 20,
        }),
      });
    });

    it('mapea reglas con campos nulos y línea sin datos', async () => {
      const { prisma, tx } = buildPrisma();
      tx.$queryRaw
        .mockResolvedValueOnce([invSeries])
        .mockResolvedValueOnce([trSeries]);
      tx.reglaDescuento.findMany.mockResolvedValue([
        {
          id: 'R2',
          tipoBeneficio: 'MONTO_FIJO',
          valor: '3',
          prioridad: 0,
          cantidadMinima: null,
          codigoCliente: null,
          codigoProducto: null,
          codigoCategoria: null,
          fechaInicio: null,
          fechaFin: null,
          unidadVolumen: null,
        },
      ]);
      const repo = new InvoiceRepositoryImpl(prisma as any);

      await repo.executeInvoiceInsert({
        storeId: '001',
        posNo: '1',
        employeeName: 'John',
        shiftDate: new Date(),
        shiftNumber: '1',
        customerNo: 'C1',
        customerName: 'Cliente',
        customerRtn: '',
        total: 0,
        tax: 0,
        discount: 0,
        isTicket: false,
        isCredit: false,
        comment: '',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        lines: [
          {
            lineNo: 1,
            itemCode: undefined,
            description: 'P',
            quantity: undefined,
            unitPrice: undefined,
            vatPercent: undefined,
            vatAmount: undefined,
            amountIncludingVAT: undefined,
            montoGravado: undefined,
            discount: 0,
            pumpNo: undefined,
            pumpPositionNo: undefined,
            tankNo: undefined,
            itemCategoryCode: undefined,
            genPumpLedgEntry: 0,
            vatProdPostingGroup: undefined,
            saleId: undefined,
          },
        ] as any,
        payments: [],
      });

      expect(tx.lineaVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numeroVenta: '',
          cantidad: 0,
          montoDescuentoUnitario: 0,
        }),
      });
    });

    it('lanza si no hay serie de factura', async () => {
      const { prisma, tx } = buildPrisma();
      tx.$queryRaw.mockResolvedValueOnce([]);
      const repo = new InvoiceRepositoryImpl(prisma as any);

      await expect(
        repo.executeInvoiceInsert({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          shiftDate: new Date(),
          shiftNumber: '1',
          customerNo: '',
          customerName: '',
          customerRtn: '',
          total: 100,
          tax: 0,
          discount: 0,
          isTicket: false,
          isCredit: false,
          comment: '',
          km: '',
          orden: '',
          placa: '',
          chofer: '',
          lines: [],
          payments: [],
        }),
      ).rejects.toThrow('No se encontró un rango válido (FV-HN)');
    });

    it('lanza si no hay serie TR-ID', async () => {
      const { prisma, tx } = buildPrisma();
      tx.$queryRaw.mockResolvedValueOnce([invSeries]).mockResolvedValueOnce([]);
      const repo = new InvoiceRepositoryImpl(prisma as any);

      await expect(
        repo.executeInvoiceInsert({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          shiftDate: new Date(),
          shiftNumber: '1',
          customerNo: '',
          customerName: '',
          customerRtn: '',
          total: 100,
          tax: 0,
          discount: 0,
          isTicket: false,
          isCredit: false,
          comment: '',
          km: '',
          orden: '',
          placa: '',
          chofer: '',
          lines: [],
          payments: [],
        }),
      ).rejects.toThrow('No se pudo obtener el número de transacción POS.');
    });
  });

  describe('executeCreditNote', () => {
    it('inserta nota de crédito y devuelve correlativos', async () => {
      const tx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([
            {
              codigoSerie: 'NC-HN',
              numeroLinea: 1,
              ultimoNumeroUsado: 'NC0000000000000001',
            },
          ])
          .mockResolvedValueOnce([
            {
              codigoSerie: 'TR-ID',
              numeroLinea: 1,
              ultimoNumeroUsado: 'TR0000000000000001',
            },
          ]),
        serieDocumento: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({ numeroInicio: 'IN', cai: null }),
        },
        venta: { create: jest.fn().mockResolvedValue({}) },
        registroTransaccion: { create: jest.fn().mockResolvedValue({}) },
      };
      const prisma = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new InvoiceRepositoryImpl(prisma);

      const result = await repo.executeCreditNote({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        shiftStarting: new Date(),
        shiftNumber: '1',
        shiftId: 'TX-123',
        customerNo: 'C1',
        customerName: 'Cliente',
        customerRtn: '',
        amount: -200,
        subTotal: -180,
        billingType: '1',
        invoiceNo: 'FAC-1',
        transactionId: 'TX1',
        reason: 'Error',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        cambio: 0,
        numeroLinea: 2,
      });

      expect(tx.venta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipoDocumento: 3,
          documentoRelacionado: 'FAC-1',
          monto: -200,
        }),
      });
      expect(result).toEqual({
        nextPosTransactionId: 'TR000000000000002',
        finalInvoiceNo: 'NC00000000000000002',
      });
    });

    it('aplica defaults cuando customerNo y billingType vienen vacíos', async () => {
      const tx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([
            {
              codigoSerie: 'NC-HN',
              numeroLinea: 1,
              ultimoNumeroUsado: 'NC0000000000000001',
            },
          ])
          .mockResolvedValueOnce([
            {
              codigoSerie: 'TR-ID',
              numeroLinea: 1,
              ultimoNumeroUsado: 'TR0000000000000001',
            },
          ]),
        serieDocumento: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest
            .fn()
            .mockResolvedValue({ numeroInicio: 'IN', cai: null }),
        },
        venta: { create: jest.fn().mockResolvedValue({}) },
        registroTransaccion: { create: jest.fn().mockResolvedValue({}) },
      };
      const prisma = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new InvoiceRepositoryImpl(prisma);

      await repo.executeCreditNote({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        shiftStarting: new Date(),
        shiftNumber: '1',
        customerNo: undefined as any,
        customerName: '',
        customerRtn: undefined as any,
        amount: -100,
        subTotal: -90,
        billingType: undefined as any,
        invoiceNo: 'FAC-1',
        transactionId: 'TX1',
        reason: 'Error',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        cambio: 0,
        numeroLinea: 2,
      });

      expect(tx.venta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codigoCliente: '',
          rtnCliente: undefined,
          tipoFacturacion: 0,
        }),
      });
    });

    it('lanza si no hay rango NC', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValueOnce([]),
      };
      const prisma = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new InvoiceRepositoryImpl(prisma);

      await expect(
        repo.executeCreditNote({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          shiftStarting: new Date(),
          shiftNumber: '1',
          customerNo: '',
          customerName: '',
          customerRtn: '',
          amount: 0,
          subTotal: 0,
          billingType: '',
          invoiceNo: '',
          transactionId: '',
          reason: '',
          km: '',
          orden: '',
          placa: '',
          chofer: '',
          cambio: 0,
          numeroLinea: 2,
        }),
      ).rejects.toThrow(
        'No se encontró un rango válido para Notas de Crédito.',
      );
    });

    it('lanza si no hay serie TR-ID en la NC', async () => {
      const tx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([
            {
              codigoSerie: 'NC-HN',
              numeroLinea: 1,
              ultimoNumeroUsado: 'NC0000000000000001',
            },
          ])
          .mockResolvedValueOnce([]),
      };
      const prisma = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new InvoiceRepositoryImpl(prisma);

      await expect(
        repo.executeCreditNote({
          storeId: '001',
          posNo: 'POS01',
          employeeName: 'John',
          shiftStarting: new Date(),
          shiftNumber: '1',
          customerNo: '',
          customerName: '',
          customerRtn: '',
          amount: 0,
          subTotal: 0,
          billingType: '',
          invoiceNo: '',
          transactionId: '',
          reason: '',
          km: '',
          orden: '',
          placa: '',
          chofer: '',
          cambio: 0,
          numeroLinea: 2,
        }),
      ).rejects.toThrow('No se pudo obtener el número de transacción POS.');
    });

    it('aplica fallbacks con billingType vacío y sin shiftStarting', async () => {
      const tx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([
            {
              codigoSerie: 'NC-HN',
              numeroLinea: 1,
              ultimoNumeroUsado: 'NC0000000000000001',
            },
          ])
          .mockResolvedValueOnce([
            {
              codigoSerie: 'TR-ID',
              numeroLinea: 1,
              ultimoNumeroUsado: 'TR0000000000000001',
            },
          ]),
        serieDocumento: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({ numeroInicio: 'IN', cai: null }),
        },
        venta: { create: jest.fn().mockResolvedValue({}) },
        registroTransaccion: { create: jest.fn().mockResolvedValue({}) },
      };
      const prisma = {
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any;
      const repo = new InvoiceRepositoryImpl(prisma);

      await repo.executeCreditNote({
        storeId: '001',
        posNo: 'POS01',
        employeeName: 'John',
        shiftStarting: '',
        shiftNumber: '1',
        customerNo: '',
        customerName: '',
        customerRtn: '',
        amount: 0,
        subTotal: 0,
        billingType: '',
        invoiceNo: 'FAC-1',
        transactionId: 'TX1',
        reason: '',
        km: '',
        orden: '',
        placa: '',
        chofer: '',
        cambio: undefined as never,
        numeroLinea: 3,
      });

      expect(tx.venta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipoFacturacion: 0, cambio: 0 }),
      });
    });
  });

  describe('inserciones auxiliares', () => {
    it('insertSalesLine y insertPaymentMethod', async () => {
      const lineaVenta = { create: jest.fn().mockResolvedValue({}) };
      const pagoVenta = { create: jest.fn().mockResolvedValue({}) };
      const repo = new InvoiceRepositoryImpl({ lineaVenta, pagoVenta } as any);

      await repo.insertSalesLine({
        storeId: '001',
        nextPosTransactionId: 'NC1',
        lineNumber: 10,
        posNo: 'POS01',
        finalInvoiceNo: 'NC-1',
        sourceTransactionId: 'TX1',
        sourceInvoiceNo: 'FAC-1',
        row: {
          'POS Sales No_': 'P1',
          Description: 'D',
          Quantity: 2,
          'Unit Price Incl_ VAT': 100,
          'Unit Discount Amount': 0,
          'Discount _': 0,
          'Line Discount Amount': 5,
          'VAT _': 15,
          VAT_Amount: 30,
          'Amount Including VAT': 200,
          'Pump No_': '1',
          'Pump Position No_': 'A',
          'Tank No_': 'T1',
          'Item Category Code': 'C',
          'Gen_ Pump Ledg_ Entry': 1,
          'VAT Prod_ Posting Group': 'ISV_15',
          SaleID: '5',
        },
      });

      expect(lineaVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cantidad: -2,
          montoDescuentoLinea: -5,
          montoIsv: -30,
          montoConIsv: -200,
          idVenta: '5',
          idTransaccionOrigen: 'TX1',
        }),
      });

      await repo.insertPaymentMethod({
        storeId: '001',
        nextPosTransactionId: 'NC1',
        chargeLineNo: 10,
        posNo: 'POS01',
        row: {
          'Charge Method Code': '1002',
          Amount: 300,
          MontoIngresado: 300,
          Description: 'EFECTIVO',
          'Datos Adicionales': 'extra',
          TasaCambio: 2,
          EsTicket: 1,
        },
      });

      expect(pagoVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codigoMetodoPago: '1002',
          monto: -300,
          tasaCambio: 2,
          esTicket: true,
        }),
      });
    });

    it('insertLealTransactions convierte idAleatorio a BigInt', async () => {
      const tx = { ventaLeal: { create: jest.fn().mockResolvedValue({}) } };
      const repo = new InvoiceRepositoryImpl({
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any);

      await repo.insertLealTransactions([
        {
          posTransactionId: 'T1',
          idTransaccionLeal: 'LEAL-1',
          puntos: 10,
          puntosActivos: 100,
          tipo: 1,
          dni: '0801',
          nombre: 'Juan',
          idAleatorio: '123',
        },
      ]);

      expect(tx.ventaLeal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idAleatorio: BigInt('123'),
          tipo: 1,
        }),
      });
    });

    it('insertLealTransactions no lanza si falla', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const tx = {
        ventaLeal: { create: jest.fn().mockRejectedValue(new Error('x')) },
      };
      const repo = new InvoiceRepositoryImpl({
        $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      } as any);

      await expect(
        repo.insertLealTransactions([
          {
            posTransactionId: 'T1',
            idTransaccionLeal: 'LEAL-1',
            puntos: 10,
            puntosActivos: 100,
            tipo: 1,
            dni: '',
            nombre: '',
            idAleatorio: null,
          },
        ]),
      ).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('insertLealTransactions no hace nada con arreglo vacío', async () => {
      const repo = new InvoiceRepositoryImpl({
        $transaction: jest.fn(),
      } as any);

      await expect(repo.insertLealTransactions([])).resolves.toBeUndefined();
      expect(repo['prisma'].$transaction).not.toHaveBeenCalled();
    });
  });

  describe('revisiones y consultas', () => {
    it('checkExistingReversion detecta venta o línea relacionada', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        venta: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ id: 1 })
            .mockResolvedValueOnce(null),
        },
        lineaVenta: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 2 }),
        },
      } as any);

      await expect(repo.checkExistingReversion('FAC-1', 'TX1')).resolves.toBe(
        true,
      );
      await expect(repo.checkExistingReversion('FAC-1', 'TX1')).resolves.toBe(
        false,
      );
      await expect(repo.checkExistingReversion('FAC-1', 'TX1')).resolves.toBe(
        true,
      );
    });

    it('getInvoiceLealTransactions devuelve [] si falla', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        ventaLeal: { findMany: jest.fn().mockRejectedValue(new Error('x')) },
      } as any);

      await expect(repo.getInvoiceLealTransactions('T1')).resolves.toEqual([]);
    });

    it('getInvoiceCampanas une con la tabla campana', async () => {
      const participacionCampana = {
        findMany: jest.fn().mockResolvedValue([
          { idCampana: 1, correlativo: '001-ABC' },
          { idCampana: null, correlativo: 'x' },
        ]),
      };
      const campana = {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 1, nombre: 'Campana 1', textoTicket: 'Ticket' },
          ]),
      };
      const repo = new InvoiceQueryRepositoryImpl({ participacionCampana, campana } as any);

      const result = await repo.getInvoiceCampanas('T1');

      expect(result[0]).toEqual({
        campanaId: 1,
        nombre: 'Campana 1',
        textoTicket: 'Ticket',
        correlativo: '001-ABC',
      });
      expect(result[1].nombre).toBeUndefined();
      expect(campana.findMany).toHaveBeenCalled();
    });

    it('getInvoiceCampanas devuelve [] si falla', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        participacionCampana: { findMany: jest.fn().mockRejectedValue(new Error('x')) },
      } as any);

      await expect(repo.getInvoiceCampanas('T1')).resolves.toEqual([]);
    });

    it('findStoreConfigField devuelve null sin config o campo', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        configuracionTienda: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ idTienda: '001', config: {} }),
        },
      } as any);

      await expect(repo.findStoreConfigField('001', 'x')).resolves.toBeNull();
      await expect(repo.findStoreConfigField('001', 'x')).resolves.toBeNull();
    });

    it('getReasons devuelve [] si falla', async () => {
      const repo = new InvoiceQueryRepositoryImpl({
        motivo: { findMany: jest.fn().mockRejectedValue(new Error('x')) },
      } as any);

      await expect(repo.getReasons()).resolves.toEqual([]);
    });
  });

  describe('searchInvoices', () => {
    it('filtra por factura y cliente', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          numeroDocumento: 'FAC-1',
          idTransaccionPos: 'TX1',
          tipoDocumento: 1,
          nombreCliente: 'Cliente',
          codigoCliente: 'C1',
          monto: 200,
          fechaHoraVenta: new Date(),
          rtnCliente: 'RTN',
        },
      ]);
      const repo = new InvoiceQueryRepositoryImpl({
        venta: { findMany },
        registroTransaccion: { findMany: jest.fn().mockResolvedValue([]) },
        ventaLeal: { findMany: jest.fn().mockResolvedValue([]) },
        participacionCampana: { findMany: jest.fn().mockResolvedValue([]) },
      } as any);

      const result = await repo.searchInvoices({
        storeId: '001',
        avanzado: false,
        factura: 'FAC-1',
        customerName: 'Cliente',
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            numeroDocumento: 'FAC-1',
            nombreCliente: { contains: 'Cliente' },
          }),
        }),
      );
      expect(result[0]['POS Sales Doc_ No_']).toBe('FAC-1');
    });

    it('filtra por fechas y turno avanzado', async () => {
      const ventaFindMany = jest.fn().mockResolvedValue([]);
      const registroFindMany = jest
        .fn()
        .mockResolvedValue([{ idTransaccionPos: 'TX1' }]);
      const repo = new InvoiceQueryRepositoryImpl({
        venta: { findMany: ventaFindMany },
        registroTransaccion: { findMany: registroFindMany },
        ventaLeal: { findMany: jest.fn().mockResolvedValue([]) },
        participacionCampana: { findMany: jest.fn().mockResolvedValue([]) },
        empleado: { findUnique: jest.fn().mockResolvedValue(null) },
      } as any);

      await repo.searchInvoices({
        storeId: '001',
        avanzado: true,
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-15',
        turno: '1',
        employeeName: 'John',
        fechaTurno: '2026-08-15',
      });

      const call = ventaFindMany.mock.calls[0][0];
      expect(call.where.fechaHoraVenta).toEqual({
        gte: new Date('2026-08-01T00:00:00'),
        lte: new Date('2026-08-15T23:59:59'),
      });
      expect(call.where.idTransaccionPos).toEqual({ in: ['TX1'] });
      expect(registroFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ numeroTurno: '1' }),
        }),
      );
    });
  });

  describe('consultas simples', () => {
    it('findAll mapea y findByNo delega', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          numeroDocumento: 'FAC-1',
          idTienda: '001',
          codigoPos: 'POS01',
          nombreCliente: 'Cliente',
          monto: 200,
          fechaHoraVenta: new Date(),
        },
      ]);
      const findFirst = jest.fn().mockResolvedValue({ id: 1 });
      const repo = new InvoiceQueryRepositoryImpl({
        venta: { findMany, findFirst },
      } as any);

      const all = await repo.findAll();
      expect(all[0]).toMatchObject({
        invoiceNo: 'FAC-1',
        storeId: '001',
        total: 200,
      });

      await expect(repo.findByNo('FAC-1')).resolves.toEqual({ id: 1 });
    });
  });

  describe('creditNote', () => {
    it('genera la NC leyendo la venta original y sus líneas/pagos', async () => {
      const venta = {
        idTransaccionPos: 'TR0001',
        idTienda: '001',
        codigoPos: 'POS01',
        numeroDocumento: 'FAC-1',
        codigoCliente: 'C-2',
        nombreCliente: 'Ana',
        rtnCliente: '0801',
        monto: 200,
        subtotal: 170,
        tipoFacturacion: 1,
        tipoDocumento: 1,
      };
      const tx = { fechaTurno: new Date(), numeroTurno: '5' };
      const prisma = {
        venta: { findFirst: jest.fn().mockResolvedValue(venta) },
        registroTransaccion: {
          findFirst: jest.fn().mockResolvedValue(tx),
        },
        lineaVenta: {
          findMany: jest.fn().mockResolvedValue([
            {
              numeroVenta: 'GAS',
              descripcion: 'Gasolina',
              cantidad: 2,
              precioUnitarioConIsv: 100,
              numeroBomba: 'B1',
            },
          ]),
        },
        pagoVenta: {
          findMany: jest.fn().mockResolvedValue([
            {
              codigoMetodoPago: '1002',
              monto: 200,
              montoIngresado: 200,
              descripcion: 'EFECTIVO',
              tasaCambio: 1,
              esTicket: false,
            },
          ]),
        },
        metodoPago: {
          findMany: jest.fn().mockResolvedValue([
            {
              codigo: '1002',
              descripcion: 'EFECTIVO',
              categoria: 'EFECTIVO',
            },
          ]),
        },
      } as any;

      const repo = new InvoiceRepositoryImpl(
        prisma,
        undefined,
        {
          getInvoiceLines: async () => prisma.lineaVenta.findMany(),
          getInvoicePayments: async () => prisma.pagoVenta.findMany(),
        } as any
      );
      const executeCreditNote = jest.fn().mockResolvedValue({
        nextPosTransactionId: 'TR0002',
        finalInvoiceNo: 'NC-HN000000000000001',
      });
      const insertSalesLine = jest.fn().mockResolvedValue(undefined);
      const insertPaymentMethod = jest.fn().mockResolvedValue(undefined);
      (repo as any).executeCreditNote = executeCreditNote;
      (repo as any).insertSalesLine = insertSalesLine;
      (repo as any).insertPaymentMethod = insertPaymentMethod;

      const result = await repo.creditNote('FAC-1', 'Devolución');

      expect(prisma.venta.findFirst).toHaveBeenCalledWith({
        where: { numeroDocumento: 'FAC-1' },
      });
      expect(executeCreditNote).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNo: 'FAC-1',
          transactionId: 'TR0001',
          reason: 'Devolución',
          amount: -200,
          subTotal: -170,
          customerNo: 'C-2',
          customerRtn: '0801',
          shiftNumber: '5',
          billingType: '1',
        }),
      );
      expect(insertSalesLine).toHaveBeenCalledTimes(1);
      expect(insertSalesLine).toHaveBeenCalledWith(
        expect.objectContaining({
          nextPosTransactionId: 'TR0002',
          finalInvoiceNo: 'NC-HN000000000000001',
          sourceInvoiceNo: 'FAC-1',
          lineNumber: 10,
        }),
      );
      expect(insertPaymentMethod).toHaveBeenCalledTimes(1);
      expect(insertPaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          nextPosTransactionId: 'TR0002',
          chargeLineNo: 10,
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it('lanza error si la factura original no existe', async () => {
      const repo = new InvoiceRepositoryImpl({
        venta: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any);

      await expect(repo.creditNote('NO-EXISTE', 'x')).rejects.toThrow(
        'No se encontró la factura NO-EXISTE.',
      );
    });

    it('creditNote aplica fallbacks cuando la venta trae campos nulos', async () => {
      const prisma = {
        venta: {
          findFirst: jest.fn().mockResolvedValue({
            idTransaccionPos: 'TR0001',
            idTienda: null,
            codigoPos: null,
            numeroDocumento: 'FAC-1',
            codigoCliente: null,
            nombreCliente: null,
            rtnCliente: null,
            monto: null,
            subtotal: null,
            tipoFacturacion: null,
          }),
        },
        registroTransaccion: { findFirst: jest.fn().mockResolvedValue(null) },
        lineaVenta: { findMany: jest.fn().mockResolvedValue([]) },
        pagoVenta: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;

      const repo = new InvoiceRepositoryImpl(
        prisma,
        undefined,
        {
          getInvoiceLines: async () => [],
          getInvoicePayments: async () => [],
        } as any
      );
      const executeCreditNote = jest.fn().mockResolvedValue({
        nextPosTransactionId: 'TR0002',
        finalInvoiceNo: 'NC-1',
      });
      const insertSalesLine = jest.fn().mockResolvedValue(undefined);
      const insertPaymentMethod = jest.fn().mockResolvedValue(undefined);
      (repo as any).executeCreditNote = executeCreditNote;
      (repo as any).insertSalesLine = insertSalesLine;
      (repo as any).insertPaymentMethod = insertPaymentMethod;

      await repo.creditNote('FAC-1', 'Devolución');

      expect(executeCreditNote).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: '',
          posNo: '',
          customerNo: '',
          customerName: '',
          customerRtn: '',
          amount: -0,
          subTotal: -0,
          billingType: '1',
          shiftStarting: expect.any(Date),
          shiftNumber: '',
        }),
      );
    });
  });

  describe('insertSalesLine / insertPaymentMethod (NC)', () => {
    it('mapea filas con campos nulos a valores por defecto', async () => {
      const lineaVenta = { create: jest.fn().mockResolvedValue({}) };
      const pagoVenta = { create: jest.fn().mockResolvedValue({}) };
      const repo = new InvoiceRepositoryImpl({
        lineaVenta,
        pagoVenta,
      } as any);

      await repo.insertSalesLine({
        storeId: '001',
        posNo: '1',
        nextPosTransactionId: 'TR1',
        finalInvoiceNo: 'NC-1',
        sourceInvoiceNo: 'FAC-1',
        sourceTransactionId: 'TR0',
        lineNumber: 1,
        row: {} as any,
      });
      await repo.insertPaymentMethod({
        storeId: '001',
        posNo: '1',
        nextPosTransactionId: 'TR1',
        chargeLineNo: 1,
        row: {} as any,
      });

      expect(lineaVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numeroVenta: '',
          cantidad: -0,
          precioUnitarioConIsv: 0,
          montoDescuentoUnitario: 0,
          descuento: 0,
          montoDescuentoLinea: -0,
          isv: 0,
          montoIsv: -0,
          montoConIsv: -0,
          numeroBomba: '',
          posicionBomba: '',
          numeroTanque: '',
          codigoCategoria: '',
          grupoIsv: '',
          idVenta: null,
        }),
      });
      expect(pagoVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codigoMetodoPago: '',
          monto: -0,
          descripcion: '',
          datosAdicionales: '',
          tasaCambio: 1,
          montoIngresado: -0,
        }),
      });
    });

    it('mapea valores positivos de la fila NC', async () => {
      const lineaVenta = { create: jest.fn().mockResolvedValue({}) };
      const repo = new InvoiceRepositoryImpl({
        lineaVenta,
      } as any);

      await repo.insertSalesLine({
        storeId: '001',
        posNo: '1',
        nextPosTransactionId: 'TR1',
        finalInvoiceNo: 'NC-1',
        sourceInvoiceNo: 'FAC-1',
        sourceTransactionId: 'TR0',
        lineNumber: 1,
        row: {
          'POS Sales No_': 'GAS',
          Quantity: 2,
          'Unit Price Incl_ VAT': 100,
          'Unit Discount Amount': 1,
          'Discount _': 2,
          'Line Discount Amount': 3,
          'VAT _': 15,
          VAT_Amount: 15,
          'Amount Including VAT': 200,
          'Pump No_': 'B1',
          'Gen_ Pump Ledg_ Entry': 1,
          SaleID: '7',
          'VAT Prod_ Posting Group': 'ISV15',
        } as any,
      });

      expect(lineaVenta.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numeroVenta: 'GAS',
          cantidad: -2,
          precioUnitarioConIsv: 100,
          descuento: 2,
          montoDescuentoLinea: -3,
          isv: 15,
          montoIsv: -15,
          montoConIsv: -200,
          numeroBomba: 'B1',
          generaAsientoBomba: true,
          grupoIsv: 'ISV15',
          idVenta: '7',
        }),
      });
    });
  });

  describe('helpers y fallbacks', () => {
    it('remainingInvoices calcula la diferencia de correlativos', () => {
      const repo = new InvoiceQueryRepositoryImpl({} as any);
      expect(
        (repo as any).remainingInvoices(
          '00000000000000000100',
          '00000000000000000050',
        ),
      ).toBe(50);
    });

    it('remainingInvoices devuelve 0 con valores nulos o no numéricos', () => {
      const repo = new InvoiceQueryRepositoryImpl({} as any);
      expect((repo as any).remainingInvoices(null, 'x')).toBe(0);
      expect((repo as any).remainingInvoices(undefined, undefined)).toBe(0);
      expect((repo as any).remainingInvoices('ABC', 'DEF')).toBe(0);
    });

    it('insertSalesLine aplica fallbacks con fila vacía', async () => {
      const create = jest.fn().mockResolvedValue({});
      const repo = new InvoiceRepositoryImpl({
        lineaVenta: { create },
      } as any);

      await repo.insertSalesLine({
        storeId: '001',
        nextPosTransactionId: 'T1',
        lineNumber: 10,
        posNo: '01',
        finalInvoiceNo: 'NC1',
        sourceTransactionId: 'SRC',
        sourceInvoiceNo: 'FAC1',
        row: {},
      } as never);

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          numeroVenta: '',
          numeroBomba: '',
          posicionBomba: '',
          numeroTanque: '',
          codigoCategoria: '',
          generaAsientoBomba: false,
          grupoIsv: '',
          idVenta: null,
        }),
      });

      const data = create.mock.calls[0][0].data;
      expect(data.cantidad).toBe(-0);
      expect(data.montoConIsv).toBe(-0);
      expect(data.precioUnitarioConIsv).toBe(0);
    });

    it('insertPaymentMethod aplica fallbacks con fila vacía', async () => {
      const create = jest.fn().mockResolvedValue({});
      const repo = new InvoiceRepositoryImpl({
        pagoVenta: { create },
      } as any);

      await repo.insertPaymentMethod({
        storeId: '001',
        nextPosTransactionId: 'T1',
        chargeLineNo: 10,
        posNo: '01',
        row: {},
      } as never);

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codigoMetodoPago: '',
          descripcion: '',
          datosAdicionales: '',
          esTicket: false,
        }),
      });

      const data = create.mock.calls[0][0].data;
      expect(data.tasaCambio).toBe(1);
      expect(data.monto).toBe(-0);
      expect(data.montoIngresado).toBe(-0);
    });

    it('searchInvoices sin filtros hace búsqueda básica', async () => {
      const venta = { findMany: jest.fn().mockResolvedValue([]) };
      const repo = new InvoiceQueryRepositoryImpl({
        venta,
        registroTransaccion: { findMany: jest.fn().mockResolvedValue([]) },
        ventaLeal: { findMany: jest.fn().mockResolvedValue([]) },
        participacionCampana: { findMany: jest.fn().mockResolvedValue([]) },
      } as any);

      await repo.searchInvoices({ storeId: '001', avanzado: false });

      expect(venta.findMany).toHaveBeenCalledWith({
        where: { idTienda: '001' },
        orderBy: { fechaHoraVenta: 'desc' },
        take: 200,
      });
    });

    it('getFidelizacionPaymentCodes devuelve lista de códigos y maneja errores', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([{ codigo: '1009' }, { codigo: 'L01' }])
        .mockRejectedValueOnce(new Error('db down'));
      const repo = new InvoiceQueryRepositoryImpl({
        metodoPago: { findMany },
      } as any);

      const codes = await repo.getFidelizacionPaymentCodes();
      expect(codes).toEqual(['1009', 'L01']);

      const fallback = await repo.getFidelizacionPaymentCodes();
      expect(fallback).toEqual([]);
    });
  });
});

