# Diseño: Backend Hexagonal 100%

## Context

El backend ya cumple la regla de dependencia hexagonal (domain no importa de application/infrastructure; application no importa de infrastructure). La única fisura son 3 puertos `out` que usan tipos `Prisma` del cliente generado:
- `dispenser-repository.interface.ts` → `Prisma.HoseConfig?` (tipos en firmas de métodos).
- `shift-repository.interface.ts` → importa tipos de `generated/prisma`.
- `pos-config-repository.interface.ts` → importa tipos de `generated/prisma`.

Ver proposal.md para motivación y alcance.

## Goals / Non-Goals

**Goals**
- Cero imports de `generated/prisma` en `src/domain/**` (verificable con grep en CI).
- Tipos nativos de dominio que representen los datos que los adapters intercambian.
- CI que falle si aparecen nuevas fugas de infraestructura al dominio.

**Non-Goals**
- No cambiar contratos HTTP ni comportamiento de la API (refactor interno).
- No migrar el resto del sistema; solo los 3 puertos señalados + limpieza listada en proposal.

## Decisions

### D1. Tipos nativos por puerto (no reutilizar entidades existentes)
Para cada puerto se definen tipos de dominio dentro de la interfaz (o en `domain/entities`) con los campos exactos que usa el negocio. Los adapters (repositorios) mapean `Prisma.X` → tipo de dominio.
- **Alternativa considerada**: exponer `Prisma.X` como tipo de dominio mediante alias (`export type HoseConfig = Prisma.HoseConfig`). Se descarta porque el alias sigue acoplado al ORM (si Prisma cambia, el contrato cambia).

### D2. Mapeo en el adapter, no en el caso de uso
Los repositorios hacen el `map` (como ya hacen hoy con `mapProduct`, `mapStoreConfig`). Los casos de uso quedan intactos porque ya consumen la interfaz.

### D3. Guardia en CI (opcional pero recomendado)
Añadir un paso de CI que falle si `rg -n "generated/prisma" src/domain` devuelve algo. Previene regresión de la regla hexagonal.
- **Alternativa**: dependency-cruiser o ESLint `import/no-restricted-paths`. Se elige el grep simple por KISS; dependency-cruiser se puede añadir después si se quiere una herramienta más completa.

### D4. Thresholds de cobertura honestos
Subir `coverageThreshold.global` a ~90% statements/lines, ~80% branches, ~90% functions. El nivel actual real es 96/86/95, así que no debería romper el build; frena regresiones futuras.

### D5. Renombrado `rtf` → `rtn`
Cambiar el campo en `domain/entities/customer.entity.ts` y su mapeo. Si el frontend consume `rtf` por contrato HTTP, se conserva la clave de salida (`rtn`/`rtf`) o se documenta el cambio de contrato como **BREAKING** (se decide al implementar según el uso real; ver Open Questions).

## Risks / Trade-offs

- [Los tipos nativos duplican shape de Prisma y pueden desincronizarse] → Mitigación: los tests de repositorio (mocks tipados) y la cobertura 96% detectan mapeos rotos.
- [El renombrado `rtf→rtn` rompe contrato si el frontend lo consume] → Mitigación: verificar consumidores con `rg "rtf"` antes de cambiar; si hay consumo HTTP, mantener clave de salida.
- [Subir thresholds rompe el build si la cobertura varía por máquina] → Mitigación: correr `test:cov` local antes de fijar los valores finales.

## Migration Plan

1. Definir tipos de dominio en cada puerto; mapear en adapters.
2. Ejecutar `npm run test:cov` (741 tests) y ajustar thresholds con los números reales.
3. Eliminar código muerto y `console.log` de debug.
4. Renombrar `rtf`→`rtn` tras confirmar consumo.
5. Añadir guardia de grep hexagonal al CI.

Rollback: revert del commit; los cambios son internos y reversibles.

## Open Questions

- ~~¿El frontend consume `rtf`?~~ **Resuelto**: sí, en `api/types.ts` (Customer.rtf), `api/client.ts` (createCustomer) y `PosScreen.tsx`. Renombrarlo a `rtn` sería BREAKING y toca el frontend → **se difiere** a un cambio futuro junto al refactor del frontend. En este cambio el campo `rtf` no se toca.
