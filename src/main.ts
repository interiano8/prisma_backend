import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { loadEncryptedEnv } from './utils/env-loader';
import { DomainErrorFilter } from './infrastructure/web/filters/domain-error.filter';

async function bootstrap() {
  // Load encrypted environment variables if .env.enc exists
  loadEncryptedEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Documentación OpenAPI en /api/docs (deshabilitable en producción)
  const swaggerEnabled = process.env.ENABLE_SWAGGER !== 'false';

  // Cabeceras de seguridad HTTP (CSP, X-Frame-Options, etc.).
  // CSP estricta en producción; en desarrollo (Swagger activo) se relaja
  // porque Swagger UI requiere scripts/estilos inline y CDN.
  // crossOriginResourcePolicy: los assets (imágenes de métodos de pago) se
  // sirven desde este backend pero se consumen desde el renderer Electron
  // (origen distinto), por lo que CORP debe permitir carga cross-origin.
  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'http:'],
              connectSrc: ["'self'"],
              styleSrc: ["'self'"],
              scriptSrc: ["'self'"],
            },
          },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS restringido a orígenes permitidos (CORS_ORIGINS separados por coma).
  // Sin CORS_ORIGINS, se deshabilita CORS (solo same-origin).
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  // En desarrollo el renderer (electron-vite) usa un puerto localhost dinámico;
  // además de la lista CORS_ORIGINS, se permiten orígenes localhost/127.0.0.1 en cualquier puerto.
  const isLocalhostOrigin = (origin: string) => {
    try {
      const { hostname } = new URL(origin);
      return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
      return false;
    }
  };
  app.enableCors({
    origin:
      corsOrigins.length > 0
        ? (origin, callback) => {
            if (!origin || corsOrigins.includes(origin) || isLocalhostOrigin(origin)) {
              callback(null, true);
            } else {
              callback(new Error('Origen CORS no permitido'));
            }
          }
        : false,
  });

  // Servir imágenes estáticas (medios de pago) desde la carpeta Imagenes
  app.useStaticAssets(join(process.cwd(), 'Imagenes'), {
    prefix: '/images/',
    maxAge: '1d',
    setHeaders: (res) =>
      res.setHeader('Cache-Control', 'public, max-age=86400'),
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Traducción de errores de dominio a respuestas HTTP
  app.useGlobalFilters(new DomainErrorFilter());

  // Documentación OpenAPI en /api/docs (deshabilitable en producción)
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Prisma Backend API')
      .setDescription(
        'Backend POS de gasolinera: facturación, turnos, surtidores, Leal y sync con Fusion.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`Prisma Backend is running on: http://0.0.0.0:${port}/api`);
}
void bootstrap();
