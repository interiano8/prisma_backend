import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadEncryptedEnv } from '../src/utils/env-loader';
import { DomainErrorFilter } from '../src/infrastructure/web/filters/domain-error.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import helmet from 'helmet';

describe('Flujo transaccional (e2e contra BD de prueba)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadEncryptedEnv();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    // Reset del estado transaccional para que el flujo sea determinista
    const prisma = app.get(PrismaService);
    await prisma.lineaVenta.deleteMany();
    await prisma.pagoVenta.deleteMany();
    await prisma.venta.deleteMany();
    await prisma.registroTransaccion.deleteMany();
    await prisma.turno.deleteMany();
    await prisma.$executeRawUnsafe(`
      INSERT INTO empleados (usuario, nombre, esta_activo) VALUES ('e2e', 'e2e', true)
      ON CONFLICT (usuario) DO NOTHING
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE series_documento SET
        abierta = true,
        en_edicion = false,
        ultimo_numero_usado = CASE codigo_serie
          WHEN 'FV-HN' THEN 'FV0000000000000000'
          WHEN 'TR-ID' THEN 'TR0000000000000000'
          WHEN 'NC-HN' THEN 'NC0000000000000000'
          ELSE ultimo_numero_usado
        END
      WHERE codigo_serie IN ('FV-HN', 'TR-ID', 'NC-HN')
    `);
    await prisma.turno.create({
      data: {
        idTransaccionPos: 'TR-E2E-0001',
        idTienda: '001',
        codigoPos: '01',
        turno: '1',
        inicioTurno: new Date(),
        importeContado: 0,
        nombreEmpleado: 'e2e',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('venta → cierre de turno → nota de crédito mantiene consistencia', async () => {
    // 1) Venta de contado con un producto
    const venta = await request(app.getHttpServer())
      .post('/api/invoices/create')
      .send({
        storeId: '001',
        posNo: '01',
        shiftNumber: '1',
        customerNo: 'CF',
        customerName: 'Consumidor Final',
        customerRtn: '',
        items: [
          {
            code: 'P-E2E',
            description: 'Producto e2e',
            qty: 1,
            price: 100,
            tax: 15,
            discount: 0,
            total: 115,
          },
        ],
        payments: [{ method: 'EFECTIVO', code: 'CASH', amount: 115 }],
        total: 115,
        tax: 15,
        discount: 0,
      })
      .expect(200);

    expect(venta.body).toMatchObject({ success: true });
    expect(venta.body.invoiceNo).toMatch(/^FV/);
    expect(venta.body.posTransactionId).toBeTruthy();
    const invoiceNo = venta.body.invoiceNo as string;
    const transactionId = venta.body.posTransactionId as string;

    // La venta quedó persistida con su correlativo
    const persisted = await request(app.getHttpServer())
      .get('/api/invoices/search')
      .query({ storeId: '001', factura: invoiceNo })
      .expect(200);
    const rows = Array.isArray(persisted.body) ? persisted.body : [];
    expect(
      rows.some((r: any) => String(r['POS Sales Doc_ No_']) === invoiceNo),
    ).toBe(true);

    // 2) Cierre del turno calcula los totales de la venta de contado
    const cierre = await request(app.getHttpServer())
      .post('/api/shift/close')
      .send({
        storeId: '001',
        posNo: '01',
        employeeName: 'e2e',
        actualAmount: 0,
      })
      .expect(200);
    expect(cierre.body).toEqual({ success: true });

    // 3) Nota de crédito revierte la factura (requiere turno abierto)
    await request(app.getHttpServer())
      .post('/api/shift/open')
      .send({
        storeId: '001',
        posNo: '01',
        employeeName: 'e2e',
        initialAmount: 0,
        shiftNumber: 3,
      })
      .expect(200);

    const nc = await request(app.getHttpServer())
      .post('/api/invoices/credit-note')
      .send({
        transactionId,
        invoiceNo,
        reason: 'Prueba e2e',
        storeId: '001',
        posNo: '01',
        username: 'e2e',
        adminPassword: 'e2e-admin',
      })
      .expect(200);

    expect(nc.body).toMatchObject({ success: true });
  });

  it('el cierre marca el turno como cerrado', async () => {
    await request(app.getHttpServer())
      .post('/api/shift/open')
      .send({
        storeId: '001',
        posNo: '01',
        employeeName: 'e2e-b',
        initialAmount: 0,
        shiftNumber: 2,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/shift/close')
      .send({
        storeId: '001',
        posNo: '01',
        employeeName: 'e2e-b',
        actualAmount: 0,
      })
      .expect(200);

    const state = await request(app.getHttpServer())
      .get('/api/shift/open')
      .query({ storeId: '001', employeeName: 'e2e-b', posNo: '01' })
      .expect(200);
    expect(state.body).toHaveProperty('Shift');
  });
});