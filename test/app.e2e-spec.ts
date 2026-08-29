import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadEncryptedEnv } from '../src/utils/env-loader';
import { DomainErrorFilter } from '../src/infrastructure/web/filters/domain-error.filter';
import helmet from 'helmet';

describe('API (e2e - integración contra Postgres)', () => {
  let app: INestApplication;

  beforeAll(() => {
    loadEncryptedEnv();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api responde Hello World', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('GET /api/payment/methods devuelve los medios de pago con categoría', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/payment/methods')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('code');
    expect(res.body[0]).toHaveProperty('categoria');
    expect(res.body[0]).toHaveProperty('requiereReferencia');
  });

  it('GET /api/pos-config/01 devuelve la configuración del POS', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pos-config/01')
      .expect(200);
    expect(res.body).toHaveProperty('mostrarBombas');
    expect(res.body).toHaveProperty('mostrarTeclado');
  });

  it('GET /api/dispensers/status devuelve un arreglo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dispensers/status')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/invoices/reasons devuelve un arreglo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/invoices/reasons')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('aplica cabeceras de seguridad (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('rechaza login con credenciales inválidas (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'noexiste',
        password: 'x',
        storeId: '001',
        posNo: '01',
      })
      .expect(401);
  });

  it('valida el body del login (400 si faltan campos)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'x' })
      .expect(400);
  });

  it('protege rutas sensibles (401 sin token)', async () => {
    await request(app.getHttpServer())
      .put('/api/auth/preferences')
      .send({ username: 'jdoe', theme: 'dark' })
      .expect(401);
  });

  it('GET /api/customers/search devuelve un arreglo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/customers/search')
      .query({ q: '' })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/customers/by-code/:code devuelve 200 (null si no existe)', async () => {
    await request(app.getHttpServer())
      .get('/api/customers/by-code/NOEXISTE')
      .expect(200);
  });

  it('GET /api/products devuelve un arreglo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/products/:code devuelve 200 (null si no existe)', async () => {
    await request(app.getHttpServer())
      .get('/api/products/NOEXISTE')
      .expect(200);
  });

  it('GET /api/pos-config/:posNo devuelve defaults para POS inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/pos-config/999')
      .expect(200);
    expect(res.body).toHaveProperty('mostrarBombas');
    expect(res.body).toHaveProperty('mostrarTeclado');
    expect(res.body).toHaveProperty('numTransaccionesBombas');
  });

  it('GET /api/shift/open devuelve estado del turno', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/shift/open')
      .query({ storeId: '001', employeeName: 'e2e', posNo: '01' })
      .expect(200);
    expect(res.body).toHaveProperty('Shift');
  });

  it('GET /api/dispensers/hoses devuelve un arreglo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dispensers/hoses')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/dispensers/transactions/:pumpId devuelve un arreglo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dispensers/transactions/1')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/fusion-sync/status devuelve el estado del sync', async () => {
    await request(app.getHttpServer())
      .get('/api/fusion-sync/status')
      .expect(200);
  });

  it('POST /api/invoices/create rechaza body inválido (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices/create')
      .send({ storeId: '001' })
      .expect(400);
  });

  it('POST /api/auth/login-rfid rechaza body inválido (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login-rfid')
      .send({ rfidCode: 'x' })
      .expect(400);
  });
});
