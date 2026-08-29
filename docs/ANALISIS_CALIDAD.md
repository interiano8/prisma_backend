# Análisis de calidad — Backend Prisma

Fecha: 2026-08-15. Evaluación honesta del estado del código respecto a Clean Code, SOLID, KISS y Arquitectura Hexagonal, más el estado de las pruebas.

## 1. Cumplimiento de principios

### Arquitectura Hexagonal — 80%
- ✅ **Bien separado**: `domain/` (entidades, servicios puros, `ports/in`, `ports/out`), `application/use-cases/`, `infrastructure/` (repositorios, controladores web). Los casos de uso dependen de interfaces (puertos), no de implementaciones.
- ✅ Los repositorios implementan las interfaces de `ports/out` y se inyectan por token (`@Inject('XxxRepository')`).
- ❌ **Violaciones** (la capa de aplicación accede a infraestructura directamente):
  - `src/shift/shift.service.ts` inyecta `PrismaService` y hace consultas directas.
  - `src/dispensers/dispensers.service.ts` inyecta `PrismaService` y hace consultas directas.
  - Estos servicios deberían usar únicamente los repositorios (puertos de salida).

### SOLID
- ✅ **S (SRP) parcial**: los casos de uso son de responsabilidad única.
- ❌ **S (SRP) violado**: `invoices.service.ts` (482 líneas) y `dispensers.service.ts` (625 líneas) son "god services" que mezclan orquestación, lógica de negocio y acceso a datos.
- ✅ **O (OCP)**: las nuevas funcionalidades se agregan como nuevos casos de uso sin modificar existentes.
- ✅ **L (LSP)**: interfaces bien definidas; las implementaciones son sustituibles.
- ✅ **I (ISP)**: interfaces pequeñas y específicas por repositorio.
- ✅ **D (DIP)**: los casos de uso dependen de abstracciones (`ports/out`).

### KISS
- ⚠️ **Regular**: la lógica de facturación quedó compleja (herencia del ERP Dynamics: CAI, correlativos, múltiples stored procedures reimplementados). El `invoice-repository.ts` (741 líneas) concentra demasiada lógica.
- ⚠️ `leal-repository.ts` (466 líneas) mezcla HTTP y persistencia.

### Clean Code
- ⚠️ Variables/métodos con `any` en repositorios (herencia del mapeo desde T-SQL).
- ⚠️ Nombres en inglés en entidades y español en BD (por decisión de diseño; documentado).
- ⚠️ Comentarios heredados en inglés/español mezclados.

## 2. Pruebas

| Tipo | Estado | Detalle |
|---|---|---|
| Unitarias | ✅ 267 tests | Servicios de dominio, casos de uso, repositorios (payment, shift, store-config, pos-config), datetime, seguridad |
| Cobertura | ⚠️ parcial | Servicios de dominio ~94%; repositorios mejoraron (payment 91%, pos-config 86%, store-config 75%) pero varios siguen en 0% (auth, customer, product, invoice, dispenser, leal, sorteos) |
| Mutación | ✅ 72.73% | Stryker sobre `domain/services` + `datetime` (umbral break 60%) |
| Integración (e2e) | ⚠️ pendiente | `test/app.e2e-spec.ts` existe pero no está funcional |
| Seguridad | ✅ parcial | `helmet` agregado; test de `verifyPasswordHash` (rechazo de contraseñas y hashes malformados) |
| Rendimiento | ⚠️ pendiente | No hay benchmarks; el sync Fusion fue hecho asíncrono para no bloquear el arranque |

## 3. Comandos

```bash
pnpm test              # unitarias
pnpm test:cov          # unitarias + cobertura
pnpm test:e2e          # integración (pendiente de habilitar)
pnpm test:mutation     # Stryker (mutación)
```

## 4. Recomendaciones (roadmap)

1. Extraer la lógica de `invoices.service.ts` a casos de uso granulares (SRP).
2. Eliminar `PrismaService` de `shift.service.ts` y `dispensers.service.ts`, moviendo esas consultas a repositorios.
3. Cubrir los repositorios restantes (auth, customer, product, invoice, dispenser, leal, sorteos) con tests unitarios (Prisma mockeado).
4. Habilitar e2e reales contra una base Postgres de prueba.
5. Añadir tests de rendimiento (Artillery/k6) y de seguridad (OWASP) sobre los endpoints.
6. Reemplazar `any` por tipos en repositorios.
