# Propuesta: Backend Hexagonal 100%

## Why

El backend sigue Arquitectura Hexagonal de forma sólida (dominio sin dependencias de infraestructura, casos de uso sobre puertos), pero 3 interfaces de `domain/ports/out` importan tipos `Prisma` del cliente generado, acoplando el dominio al ORM. Alcanzar "100% hexagonal" exige que el dominio defina sus propios tipos. De paso se limpia código muerto y se suben los umbrales de cobertura al nivel real para que el CI proteja contra regresión.

## What Changes

- **Desacoplar puertos del ORM**: reemplazar los tipos `Prisma` en `dispenser-repository.interface.ts`, `shift-repository.interface.ts` y `pos-config-repository.interface.ts` por tipos nativos de dominio; los adapters mapean a esos tipos.
- **Eliminar código muerto**: borrar `invoice-repository.createInvoice` (nunca es llamado y además hardcodea `vatPercent: 0`, un riesgo latente de facturas sin impuesto).
- **Quitar logs de debug**: eliminar los `console.log` de `invoices.service._createInvoiceInternal`.
- **Subir thresholds de cobertura** en `jest.config.js` del nivel real (~90% statements/lines, ~80% branches, ~90% functions) para que CI falle si baja.
- ~~**Renombrar `rtf` → `rtn`**~~ **Diferido**: el frontend consume `rtf` en el contrato HTTP (breaking). Se hará junto al refactor del frontend en otro cambio.

## Capabilities

No aplica: cambio puro de refactor interno sin cambio de comportamiento observable. `skip_specs: true`.

## Impact

- **Código**: `src/domain/ports/out/{dispenser,shift,pos-config}-repository.interface.ts`, `src/infrastructure/persistence/repositories/{dispenser,shift,pos-config}-repository.ts`, `src/infrastructure/persistence/repositories/invoice-repository.ts`, `src/application/services/invoices.service.ts`, `src/domain/entities/customer.entity.ts`, `jest.config.js`.
- **Tests**: los 741 tests unitarios y el e2e deben seguir verdes; se actualizan mocks si cambian tipos de mapeo.
- **Riesgo**: bajo — no cambia contratos HTTP; solo tipos internos del dominio y limpieza.
