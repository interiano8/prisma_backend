# Tareas: Backend Hexagonal 100%

## 1. Desacoplar puertos del ORM

- [x] 1.1 Definir tipos nativos de dominio para el puerto `dispenser-repository` (HoseConfig, PumpTransaction y los que usen tipos Prisma) y verificar que `src/domain/ports/out/dispenser-repository.interface.ts` no importa de `generated/prisma`
- [x] 1.2 Mapear en `dispenser-repository.ts` de los tipos Prisma a los tipos de dominio y verificar `npm run test:cov` mantiene ≥96% en ese archivo
- [x] 1.3 Definir tipos nativos de dominio para el puerto `shift-repository` y eliminar imports de `generated/prisma` de `shift-repository.interface.ts`
- [x] 1.4 Mapear en `shift-repository.ts` y verificar los tests de turnos siguen verdes
- [x] 1.5 Definir tipos nativos de dominio para el puerto `pos-config-repository` y eliminar imports de `generated/prisma` de `pos-config-repository.interface.ts`
- [x] 1.6 Mapear en el repositorio de pos-config y verificar tests de pos-config verdes
- [x] 1.7 Verificar con `rg -n "generated/prisma" src/domain` que no quedan fugas (vacío)

## 2. Limpieza de código

- [x] 2.1 Eliminar `invoice-repository.createInvoice` (código muerto) y confirmar con `rg -rn "\.createInvoice\(" src` que nada lo referencia
- [x] 2.2 Quitar los `console.log` de `invoices.service._createInvoiceInternal` y verificar `rg -n "console.log" src/application/services/invoices.service.ts` vacío

## 3. Protección en CI y cobertura

- [x] 3.1 Subir `coverageThreshold.global` en `jest.config.js` al nivel real (≈90/80/90/90) y verificar que `npm run test:cov` pasa con los 741 tests
- [x] 3.2 Añadir paso en `.github/workflows/ci.yml` que falle si `rg -n "generated/prisma" src/domain` devuelve algo (guardia hexagonal)
- [x] 3.3 Verificar el pipeline completo: `npm run build`, `npm run lint:check`, `npm run test -- --coverage` en verde
