# Graph Report - prisma_backend  (2026-08-16)

## Corpus Check
- 231 files · ~194,521 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1325 nodes · 2318 edges · 98 communities (63 shown, 35 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- ProductRepositoryImpl
- invoices.module.ts
- InvoiceRepositoryImpl
- Customer
- dispenser-status.entity.ts
- Tablas núcleo (migrar)
- f3_etl.js
- payment.module.ts
- InvoicesService
- leal.module.ts
- dispensers.module.ts
- auth.module.ts
- compilerOptions
- FusionSyncService
- UnauthorizedDomainError
- InvoicesController
- LealRepositoryImpl
- domain-error.ts
- dependencies
- ShiftRepositoryImpl
- DispenserRepositoryImpl
- InvoiceLealProcessor
- PrinterService
- GetPosConfigUseCase
- f0_analyze.js
- Resto de SPs (por categoría)
- auth.controller.ts
- printing.entity.ts
- Arquitectura — Prisma Backend
- AuthController
- PrismaService
- CreateInvoiceDto
- scripts
- AuthRepositoryImpl
- f0_generate_sp_inventory.js
- app.module.ts
- 1. Cumplimiento de principios
- README.md
- dispensers.service.ts
- .createInvoice
- shift.module.ts
- SorteosRepositoryImpl
- package.json
- exclude
- encrypt_env.js
- devDependencies
- Guía de Seguridad y Despliegue - BCPOS Backend
- security-scan.mjs
- f0_discovery.js
- f1_add_maps.js
- benchmark.ts
- mssql.d.ts
- invoice-repository.ts
- nest-cli.json
- overrides
- run_secure.js
- DispensersService
- .getTransactions
- create_test_user.js
- invoices.controller.spec.ts
- @eslint/eslintrc
- eslint-config-prettier
- perf_test.js
- class-validator
- eslint
- @nestjs/core
- eslint-import-resolver-typescript
- eslint-plugin-import
- @nestjs/common
- @nestjs/throttler
- reflect-metadata
- globals
- @eslint/js
- eslint-plugin-prettier
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- pg
- prettier
- @stryker-mutator/core
- @stryker-mutator/jest-runner
- @types/jsonwebtoken
- ts-jest
- ts-loader
- ts-node
- tsconfig-paths
- @types/express
- @types/jest
- @types/node
- @types/supertest
- typescript
- typescript-eslint

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 33 edges
2. `InvoiceRepositoryImpl` - 30 edges
3. `Tablas núcleo (migrar)` - 27 edges
4. `InvoicesService` - 25 edges
5. `LealRepositoryImpl` - 24 edges
6. `compilerOptions` - 22 edges
7. `padStoreId()` - 21 edges
8. `DispensersService` - 20 edges
9. `DispenserRepositoryImpl` - 20 edges
10. `FusionSyncService` - 18 edges

## Surprising Connections (you probably didn't know these)
- `CustomDomainError` --inherits--> `DomainError`  [EXTRACTED]
  test/infrastructure/web/filters/domain-error.filter.spec.ts → src/domain/errors/domain-error.ts
- `LoginResponse` --references--> `ShiftInfo`  [EXTRACTED]
  src/domain/ports/in/auth-use-case.interface.ts → src/domain/entities/shift.entity.ts
- `LoginResponse` --references--> `StoreConfig`  [EXTRACTED]
  src/domain/ports/in/auth-use-case.interface.ts → src/domain/entities/store-config.entity.ts
- `LoginResponse` --references--> `User`  [EXTRACTED]
  src/domain/ports/in/auth-use-case.interface.ts → src/domain/entities/user.entity.ts
- `bootstrap()` --calls--> `loadEncryptedEnv()`  [EXTRACTED]
  src/main.ts → src/utils/env-loader.ts

## Import Cycles
- None detected.

## Communities (98 total, 35 thin omitted)

### Community 0 - "ProductRepositoryImpl"
Cohesion: 0.06
Nodes (22): CalculateCartDiscountsUseCase, CartDiscountItem, Injectable, GetProductDiscountUseCase, Injectable, GetProductUseCase, Injectable, ListProductsUseCase (+14 more)

### Community 1 - "invoices.module.ts"
Cohesion: 0.16
Nodes (8): createInvoiceMutex, CreditNoteUser, ExtractedInvoiceResult, SorteosService, SorteoTicket, Inject, Injectable, Mutex

### Community 2 - "InvoiceRepositoryImpl"
Cohesion: 0.12
Nodes (3): InvoiceRepositoryImpl, Injectable, padStoreId()

### Community 3 - "Customer"
Cohesion: 0.07
Nodes (24): CreateCustomerCommand, CreateCustomerUseCase, Injectable, GetConsumidorFinalUseCase, Injectable, GetCustomerByCodeUseCase, Injectable, SearchCustomersUseCase (+16 more)

### Community 5 - "Tablas núcleo (migrar)"
Cohesion: 0.05
Nodes (43): Catálogo/referencia (migrar), `Charge Method` → **metodos_pago** _(~14 filas)_, `Customer` → **clientes** _(~1066 filas)_, `Descuentos` → **descuentos** _(~132 filas)_, Diccionario de datos — migración TPV → PostgreSQL, `Employee` → **empleados** _(~29 filas)_, Fiscal (migrar), `FuelAttendant` → **despachadores** _(~10 filas)_ (+35 more)

### Community 6 - "f3_etl.js"
Cohesion: 0.08
Nodes (32): byCat, catLabels, fs, fusion, path, root, rowCounts, scope (+24 more)

### Community 7 - "payment.module.ts"
Cohesion: 0.09
Nodes (17): GetPaymentMethodsUseCase, Inject, Injectable, ProcessPaymentUseCase, Inject, Injectable, PaymentAllocation, PaymentMethod (+9 more)

### Community 8 - "InvoicesService"
Cohesion: 0.35
Nodes (3): InvoicesService, Injectable, CreateInvoiceInput

### Community 9 - "leal.module.ts"
Cohesion: 0.06
Nodes (30): Headers, AccumulatePointsUseCase, Injectable, CheckLealStatusUseCase, Injectable, LoginLealUseCase, Injectable, RedeemPointsUseCase (+22 more)

### Community 10 - "dispensers.module.ts"
Cohesion: 0.16
Nodes (10): DispensersController, Body, Controller, HttpCode, Post, DispensersModule, Module, AuthorizePumpDto (+2 more)

### Community 11 - "auth.module.ts"
Cohesion: 0.16
Nodes (8): Injectable, ValidateAdminUseCase, PASSWORD_HASHER_PORT, TOKEN_PORT, AuthenticatedRequest, JwtAuthGuard, Inject, Injectable

### Community 12 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 13 - "FusionSyncService"
Cohesion: 0.11
Nodes (11): FusionSaleRow, FusionSyncService, Inject, Injectable, FusionSyncController, Controller, Get, FusionSyncModule (+3 more)

### Community 14 - "UnauthorizedDomainError"
Cohesion: 0.14
Nodes (9): LoginRfidUseCase, Injectable, UnauthorizedDomainError, AuthUseCase, LoginRequest, LoginResponse, LoginRfidRequest, TokenService (+1 more)

### Community 15 - "InvoicesController"
Cohesion: 0.14
Nodes (5): InvoicesController, Controller, Get, Param, Query

### Community 16 - "LealRepositoryImpl"
Cohesion: 0.08
Nodes (17): LealAccumulatePointsRequest, LealCustomer, LealLoginRequest, LealLoginResponse, LealRedeemPointsRequest, LealRegisterCustomerRequest, LealReverseTransactionRequest, LealSearchCustomerRequest (+9 more)

### Community 17 - "domain-error.ts"
Cohesion: 0.27
Nodes (10): Catch, BadRequestDomainError, ConflictDomainError, DomainError, ForbiddenDomainError, InternalDomainError, NotFoundDomainError, DomainErrorFilter (+2 more)

### Community 18 - "dependencies"
Cohesion: 0.11
Nodes (19): class-transformer, helmet, jsonwebtoken, mssql, @nestjs/platform-express, @nestjs/swagger, dependencies, class-transformer (+11 more)

### Community 19 - "ShiftRepositoryImpl"
Cohesion: 0.18
Nodes (3): Shift, ShiftRepositoryImpl, Injectable

### Community 20 - "DispenserRepositoryImpl"
Cohesion: 0.11
Nodes (4): HoseConfig, PumpTransaction, DispenserRepositoryImpl, Injectable

### Community 21 - "InvoiceLealProcessor"
Cohesion: 0.20
Nodes (5): InvoiceLealProcessor, LealOperationResult, Inject, Injectable, Inject

### Community 22 - "PrinterService"
Cohesion: 0.10
Nodes (12): PrinterService, Inject, Injectable, PosConfigModule, Module, PrinterController, Body, Controller (+4 more)

### Community 23 - "GetPosConfigUseCase"
Cohesion: 0.17
Nodes (11): GetPosConfigUseCase, PosConfigData, Injectable, Injectable, UpdatePosConfigUseCase, PosConfigController, Body, Controller (+3 more)

### Community 24 - "f0_analyze.js"
Cohesion: 0.12
Nodes (15): allTables, BACKEND_SPS, direct, fs, fusion, fusionProcByName, output, path (+7 more)

### Community 25 - "Resto de SPs (por categoría)"
Cohesion: 0.12
Nodes (15): Clientes/empleados/autenticación, Consulta de ventas/reimpresión, Correlativos y totales (cierre/reporte), Cálculo ISV/descuento, resumen y Leal, Extracción BCPOS/Fusion, FusionController, Importación de datos maestros, Inserción de ventas/pagos (+7 more)

### Community 26 - "auth.controller.ts"
Cohesion: 0.11
Nodes (15): CheckCreditValidationUseCase, Injectable, LoginUseCase, Injectable, SavePreferencesUseCase, Injectable, LoginDto, IsNotEmpty (+7 more)

### Community 27 - "printing.entity.ts"
Cohesion: 0.33
Nodes (5): InvoiceLinePrintData, InvoicePrintData, InvoiceTotals, PaymentMethodDetail, PrintingConfig

### Community 28 - "Arquitectura — Prisma Backend"
Cohesion: 0.25
Nodes (7): Arquitectura — Prisma Backend, Capas, Manejo de errores, Regla de dependencia, Testing, Variables de entorno, Verificación

### Community 29 - "AuthController"
Cohesion: 0.23
Nodes (10): AuthController, Body, Controller, Get, HttpCode, Param, Post, Put (+2 more)

### Community 30 - "PrismaService"
Cohesion: 0.14
Nodes (4): PosConfigRepositoryImpl, Injectable, PrismaService, Injectable

### Community 31 - "CreateInvoiceDto"
Cohesion: 0.29
Nodes (11): IsArray, CreateInvoiceDto, InvoiceItemDto, InvoicePaymentDto, LealPaymentData, IsNotEmpty, IsNumber, IsOptional (+3 more)

### Community 32 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, format, lint, lint:check, start, start:debug, start:dev (+9 more)

### Community 33 - "AuthRepositoryImpl"
Cohesion: 0.08
Nodes (9): StoreConfig, User, AuthRepositoryImpl, Injectable, StoreConfigRepositoryImpl, Injectable, verifyPasswordHash(), IdentityPasswordHasher (+1 more)

### Community 34 - "f0_generate_sp_inventory.js"
Cohesion: 0.17
Nodes (10): BACKEND_SPS, backendOrder, byCat, fs, fusion, path, purpose, root (+2 more)

### Community 35 - "app.module.ts"
Cohesion: 0.06
Nodes (31): Global, AppController, Controller, Get, AppModule, Module, AppService, Injectable (+23 more)

### Community 36 - "1. Cumplimiento de principios"
Cohesion: 0.20
Nodes (9): 1. Cumplimiento de principios, 2. Pruebas, 3. Comandos, 4. Recomendaciones (roadmap), Análisis de calidad — Backend Prisma, Arquitectura Hexagonal — 80%, Clean Code, KISS (+1 more)

### Community 37 - "README.md"
Cohesion: 0.14
Nodes (13): 1. Obtener un token, 2. Usar el token, 3. Variables de entorno requeridas, Autenticación JWT, Compile and run the project, Deployment, Description, License (+5 more)

### Community 38 - "dispensers.service.ts"
Cohesion: 0.21
Nodes (11): buildMockPumpTransactions(), FALLBACK_HOSES, formatDate(), formatTime(), AuthorizePumpCommand, FusionSaleRow, HoseFSFullRow, HoseFSRow (+3 more)

### Community 39 - ".createInvoice"
Cohesion: 0.27
Nodes (4): CreditNoteInput, Body, HttpCode, Post

### Community 40 - "shift.module.ts"
Cohesion: 0.06
Nodes (35): CloseFusionShiftCommand, FusionPeriodStatusResponse, FusionShiftCloseResponse, ShiftService, Inject, Injectable, CloseShiftUseCase, Injectable (+27 more)

### Community 42 - "package.json"
Cohesion: 0.22
Nodes (8): author, description, license, name, prisma, seed, private, version

### Community 43 - "exclude"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 44 - "encrypt_env.js"
Cohesion: 0.33
Nodes (6): askMasterKey(), crypto, fs, main(), path, readline

### Community 45 - "devDependencies"
Cohesion: 0.22
Nodes (9): jest, devDependencies, jest, prisma, source-map-support, supertest, prisma, source-map-support (+1 more)

### Community 46 - "Guía de Seguridad y Despliegue - BCPOS Backend"
Cohesion: 0.29
Nodes (6): 1. Encriptar las Variables de Entorno (.env), 2. Ejecutar Pruebas Locales de Forma Segura (sin servicio), 3. Instalación como Servicio de Windows (Producción), Guía de Seguridad y Despliegue - BCPOS Backend, Proceso de Instalación:, Requisitos Previos:

### Community 47 - "security-scan.mjs"
Cohesion: 0.25
Nodes (6): fileExtensions, files, findings, ROOT, SECRET_PATTERNS, SRC

### Community 48 - "f0_discovery.js"
Cohesion: 0.38
Nodes (6): fs, main(), parseDbUrl(), parseEnv(), path, sql

### Community 49 - "f1_add_maps.js"
Cohesion: 0.29
Nodes (5): file, fs, lines, out, path

### Community 50 - "benchmark.ts"
Cohesion: 0.08
Nodes (18): BenchmarkCase, benchmarks, discountService, failed, fuelCalculator, invoicePricing, rows, valueToLetters (+10 more)

### Community 51 - "mssql.d.ts"
Cohesion: 0.25
Nodes (4): Config, IConnectionPool, IRequest, mssql

### Community 53 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 54 - "overrides"
Cohesion: 0.33
Nodes (6): overrides, body-parser, glob, multer, rimraf, uuid

### Community 55 - "run_secure.js"
Cohesion: 0.40
Nodes (5): askMasterKey(), main(), path, readline, { spawn }

### Community 56 - "DispensersService"
Cohesion: 0.21
Nodes (3): DispensersService, Inject, Injectable

### Community 57 - ".getTransactions"
Cohesion: 0.29
Nodes (3): Get, Param, Query

### Community 58 - "create_test_user.js"
Cohesion: 0.50
Nodes (4): { Client }, crypto, hashPassword(), main()

### Community 59 - "invoices.controller.spec.ts"
Cohesion: 0.40
Nodes (4): CreditNoteDto, IsNotEmpty, IsOptional, IsString

## Knowledge Gaps
- **309 isolated node(s):** `fs`, `path`, `crypto`, `readline`, `$schema` (+304 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `ProductRepositoryImpl`, `AuthRepositoryImpl`, `InvoiceRepositoryImpl`, `Customer`, `payment.module.ts`, `shift.module.ts`, `SorteosRepositoryImpl`, `LealRepositoryImpl`, `ShiftRepositoryImpl`, `DispenserRepositoryImpl`, `invoice-repository.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `InvoicesService` connect `InvoicesService` to `invoices.module.ts`, `.createInvoice`, `InvoicesController`, `InvoiceLealProcessor`, `invoices.controller.spec.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `DispensersService` connect `DispensersService` to `invoices.module.ts`, `dispensers.service.ts`, `dispensers.module.ts`, `InvoiceLealProcessor`, `.getTransactions`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `crypto` to the rest of the system?**
  _309 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ProductRepositoryImpl` be split into smaller, more focused modules?**
  _Cohesion score 0.06459627329192547 - nodes in this community are weakly interconnected._
- **Should `InvoiceRepositoryImpl` be split into smaller, more focused modules?**
  _Cohesion score 0.12307692307692308 - nodes in this community are weakly interconnected._
- **Should `Customer` be split into smaller, more focused modules?**
  _Cohesion score 0.06504494976203067 - nodes in this community are weakly interconnected._