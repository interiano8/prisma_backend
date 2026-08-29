# Arquitectura — Prisma Backend

Backend NestJS (TypeScript) para el sistema POS/combustible, organizado con
**Arquitectura Hexagonal** (puertos y adaptadores).

## Capas

```
src/
├── domain/                 # Regla de negocio pura (sin dependencias externas)
│   ├── entities/           # Entidades y comandos de dominio
│   ├── errors/             # DomainError + subclases (NOT_FOUND, BAD_REQUEST…)
│   ├── ports/
│   │   ├── in/             # Puertos de entrada (contratos de casos de uso)
│   │   └── out/            # Puertos de salida (interfaces de repositorios y servicios)
│   └── services/           # Lógica pura (calculadora de combustible, descuentos,
│                           #   precios de factura, conversión número a letras)
├── application/            # Orquestación de casos de uso (depende solo de domain)
│   ├── use-cases/          # Casos de uso por módulo (auth, customer, leal,
│   │                       #   payment, pos-config, product, shift)
│   └── services/           # Casos de uso complejos con estado/orquestación
│                           #   (dispensers, invoices, shift, sorteos, fusion-sync)
├── infrastructure/         # Adaptadores e infraestructura (depende de domain)
│   ├── web/                # NestJS HTTP
│   │   ├── controllers/    # Controllers + Módulos por feature
│   │   ├── dto/            # DTOs de validación (class-validator)
│   │   ├── filters/        # DomainErrorFilter (traduce DomainError → HTTP)
│   │   ├── guards/         # JwtAuthGuard
│   │   └── middleware/
│   ├── persistence/        # Repositorios Prisma (implementan puertos out)
│   ├── external/           # Adaptadores a sistemas externos (fusion, leal, sap, vox)
│   ├── printing/           # Adaptador de impresión
│   ├── security/           # Tokens, hashing de contraseñas, JWT
│   └── config/
├── prisma/                 # Schema, migraciones y seed
├── types/                  # Tipos compartidos
└── utils/                  # Utilidades (env-loader, datetime)
```

## Regla de dependencia

Las dependencias apuntan **hacia adentro**:

```
infrastructure  ──►  application  ──►  domain
```

Enforcement (ESLint en `eslint.config.mjs`):

- `no-restricted-imports`: `src/application/**` no puede importar excepciones
  HTTP de Nest (`BadRequestException`, `UnauthorizedException`,
  `NotFoundException`, etc.). En su lugar se usan las subclases de
  `DomainError` y el `DomainErrorFilter` las traduce a HTTP.
- `import/no-restricted-paths`: `src/application` no puede importar desde
  `src/infrastructure` (ni DTOs ni tokens de seguridad).

## Manejo de errores

```ts
// domain/errors/domain-error.ts
export abstract class DomainError extends Error {
  abstract readonly code: string; // NOT_FOUND | UNAUTHORIZED | BAD_REQUEST | …
}
```

El `DomainErrorFilter` mapea cada `DomainError` a su status HTTP correspondiente.
Los casos de uso lanzan `DomainError`, nunca excepciones de Nest.

## Verificación

| Comando                 | Qué valida                              |
| ----------------------- | --------------------------------------- |
| `pnpm lint:check`       | ESLint (incluye reglas de arquitectura) |
| `pnpm exec tsc --noEmit`| Tipos                                    |
| `pnpm build`            | Build de producción                      |
| `pnpm test`             | Tests unitarios (Jest)                   |
| `pnpm test:e2e`         | Integración HTTP contra Postgres real    |
| `pnpm test:mutation`    | Mutation testing (Stryker, umbral 60)    |
| `pnpm test:perf`        | Benchmark con umbrales (gate)            |
| `pnpm test:security`    | Escaneo de secretos + `pnpm audit`       |

Contrato verde: `lint:check` 0, `tsc` 0, `build` 0, `test` y `test:e2e` verdes.

## Variables de entorno

Las variables se cargan encriptadas desde `.env.enc` (clave `KEYMASTER`) a
través de `src/utils/env-loader.ts`. En desarrollo, sin `KEYMASTER`, cae a
`.env` en texto plano. El loader **no sobreescribe** variables ya definidas en
`process.env`, por lo que en CI se inyecta `DATABASE_URL` directamente.

## Testing

- **Unitarios** (`test/**/*.spec.ts`): casos de uso y servicios con repositorios
  mockeados. Siguen la misma estructura por capas (`test/application`,
  `test/domain`, `test/infrastructure`).
- **Integración** (`test/app.e2e-spec.ts`): levanta `AppModule` y prueba rutas
  HTTP reales contra Postgres. Prioriza lecturas y validaciones (sin mutar datos).
- **Mutación** (`stryker.conf.mjs`): muta solo `domain/**`, `application/use-cases/**`,
  `utils/datetime.ts`, `domain/errors/**` y `infrastructure/web/filters/**`.
- **Rendimiento** (`scripts/benchmark.ts`): mide ops/seg de los servicios de
  dominio calientes y falla si no se alcanza el umbral.
