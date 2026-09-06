# Graph Report - prisma_backend  (2026-08-20)

## Corpus Check
- 252 files · ~200,145 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1381 nodes · 2442 edges · 105 communities (66 shown, 39 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- products.module.ts
- invoices.service.ts
- padStoreId
- Customer
- dispenser-status.entity.ts
- Tablas núcleo (migrar)
- f3_etl.js
- payment.module.ts
- InvoicesService
- leal.controller.ts
- shift-repository.ts
- app.module.ts
- compilerOptions
- FusionSyncService
- LealController
- InvoicesController
- LealRepositoryImpl
- domain-error.ts
- dependencies
- InvoiceRepositoryImpl
- DispenserRepositoryImpl
- PrismaService
- PrinterService
- GetPosConfigUseCase
- f0_analyze.js
- Resto de SPs (por categoría)
- auth.module.ts
- printing.entity.ts
- Arquitectura — Prisma Backend
- MediaController
- ts-jest
- CreateInvoiceDto
- scripts
- AuthRepositoryImpl
- f0_generate_sp_inventory.js
- main.ts
- 1. Cumplimiento de principios
- README.md
- dispensers.service.ts
- .createInvoice
- shift.module.ts
- CloseShiftDto
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
- InvoiceLealProcessor
- nest-cli.json
- overrides
- run_secure.js
- CheckLealStatusUseCase
- @eslint/eslintrc
- create_test_user.js
- AppService
- invoice-repository.ts
- SorteosRepositoryImpl
- .getAvailableShifts
- TokenService
- perf_test.js
- pg.d.ts
- eslint-config-prettier
- @nestjs/core
- eslint-import-resolver-typescript
- eslint-plugin-import
- @nestjs/common
- @nestjs/throttler
- reflect-metadata
- jest
- OpenShiftDto
- RequestLoggerMiddleware
- AuthUseCase
- class-validator
- invoices/invoices.controller.spec.ts
- @types/supertest
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
- ts-loader
- ts-node
- tsconfig-paths
- @types/express
- @types/jest
- @types/node
- typescript
- typescript-eslint

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 36 edges
2. `InvoiceRepositoryImpl` - 30 edges
3. `Tablas núcleo (migrar)` - 27 edges
4. `InvoicesService` - 26 edges
5. `LealRepositoryImpl` - 24 edges
6. `compilerOptions` - 22 edges
7. `DispensersService` - 21 edges
8. `padStoreId()` - 21 edges
9. `DispenserRepositoryImpl` - 20 edges
10. `FusionSyncService` - 19 edges

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

## Communities (105 total, 39 thin omitted)

### Community 0 - "products.module.ts"
Cohesion: 0.06
Nodes (24): CalculateCartDiscountsUseCase, CartDiscountItem, Injectable, GetProductByBarcodeUseCase, Injectable, GetProductDiscountUseCase, Injectable, GetProductUseCase (+16 more)

### Community 1 - "invoices.service.ts"
Cohesion: 0.16
Nodes (8): createInvoiceMutex, CreditNoteUser, ExtractedInvoiceResult, SorteosService, SorteoTicket, Inject, Injectable, Mutex

### Community 2 - "padStoreId"
Cohesion: 0.15
Nodes (4): Shift, ShiftRepositoryImpl, Injectable, padStoreId()

### Community 3 - "Customer"
Cohesion: 0.06
Nodes (27): CreateCustomerCommand, CreateCustomerResult, CreateCustomerUseCase, Injectable, GetConsumidorFinalUseCase, Injectable, GetCustomerByCodeUseCase, Injectable (+19 more)

### Community 5 - "Tablas núcleo (migrar)"
Cohesion: 0.05
Nodes (43): Catálogo/referencia (migrar), `Charge Method` → **metodos_pago** _(~14 filas)_, `Customer` → **clientes** _(~1066 filas)_, `Descuentos` → **descuentos** _(~132 filas)_, Diccionario de datos — migración TPV → PostgreSQL, `Employee` → **empleados** _(~29 filas)_, Fiscal (migrar), `FuelAttendant` → **despachadores** _(~10 filas)_ (+35 more)

### Community 6 - "f3_etl.js"
Cohesion: 0.08
Nodes (32): byCat, catLabels, fs, fusion, path, root, rowCounts, scope (+24 more)

### Community 7 - "payment.module.ts"
Cohesion: 0.08
Nodes (19): GetPaymentMethodsUseCase, Inject, Injectable, ProcessPaymentUseCase, Inject, Injectable, PaymentAllocation, PaymentMethod (+11 more)

### Community 8 - "InvoicesService"
Cohesion: 0.35
Nodes (3): InvoicesService, Injectable, CreateInvoiceInput

### Community 9 - "leal.controller.ts"
Cohesion: 0.09
Nodes (16): AccumulatePointsUseCase, Injectable, LoginLealUseCase, Injectable, RedeemPointsUseCase, Injectable, ReverseTransactionUseCase, Injectable (+8 more)

### Community 10 - "shift-repository.ts"
Cohesion: 0.25
Nodes (6): CloseShiftCommand, OpenShiftCommand, ShiftInfo, ShiftUseCase, serverNow(), toServerIso()

### Community 11 - "app.module.ts"
Cohesion: 0.16
Nodes (15): Global, DispensersModule, Module, FusionSyncModule, Module, InvoicesModule, Module, LealModule (+7 more)

### Community 12 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 13 - "FusionSyncService"
Cohesion: 0.12
Nodes (9): FusionSaleRow, FusionSyncService, Inject, Injectable, FusionSyncController, Controller, Get, connectMock (+1 more)

### Community 14 - "LealController"
Cohesion: 0.19
Nodes (9): Headers, LealController, Body, Controller, Get, Param, Post, Put (+1 more)

### Community 15 - "InvoicesController"
Cohesion: 0.13
Nodes (5): InvoicesController, Controller, Get, Param, Query

### Community 16 - "LealRepositoryImpl"
Cohesion: 0.08
Nodes (17): LealAccumulatePointsRequest, LealCustomer, LealLoginRequest, LealLoginResponse, LealRedeemPointsRequest, LealRegisterCustomerRequest, LealReverseTransactionRequest, LealSearchCustomerRequest (+9 more)

### Community 17 - "domain-error.ts"
Cohesion: 0.17
Nodes (14): LoginUseCase, Injectable, BadRequestDomainError, ConflictDomainError, DomainError, ForbiddenDomainError, InternalDomainError, NotFoundDomainError (+6 more)

### Community 18 - "dependencies"
Cohesion: 0.11
Nodes (19): class-transformer, helmet, jsonwebtoken, mssql, @nestjs/platform-express, @nestjs/swagger, dependencies, class-transformer (+11 more)

### Community 20 - "DispenserRepositoryImpl"
Cohesion: 0.11
Nodes (4): HoseConfig, PumpTransaction, DispenserRepositoryImpl, Injectable

### Community 21 - "PrismaService"
Cohesion: 0.14
Nodes (4): PosConfigRepositoryImpl, Injectable, PrismaService, Injectable

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

### Community 26 - "auth.module.ts"
Cohesion: 0.06
Nodes (35): CheckCreditValidationUseCase, Injectable, LoginRfidUseCase, Injectable, SavePreferencesUseCase, Injectable, Injectable, ValidateAdminUseCase (+27 more)

### Community 27 - "printing.entity.ts"
Cohesion: 0.33
Nodes (5): InvoiceLinePrintData, InvoicePrintData, InvoiceTotals, PaymentMethodDetail, PrintingConfig

### Community 28 - "Arquitectura — Prisma Backend"
Cohesion: 0.25
Nodes (7): Arquitectura — Prisma Backend, Capas, Manejo de errores, Regla de dependencia, Testing, Variables de entorno, Verificación

### Community 29 - "MediaController"
Cohesion: 0.19
Nodes (9): Res, IMAGE_EXT, MediaController, Controller, Get, Param, VIDEO_EXT, MediaModule (+1 more)

### Community 31 - "CreateInvoiceDto"
Cohesion: 0.24
Nodes (11): IsArray, CreateInvoiceDto, InvoiceItemDto, InvoicePaymentDto, LealPaymentData, IsNotEmpty, IsNumber, IsOptional (+3 more)

### Community 32 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, format, lint, lint:check, start, start:debug, start:dev (+9 more)

### Community 33 - "AuthRepositoryImpl"
Cohesion: 0.05
Nodes (18): Injectable, UpdateStoreConfigUseCase, StoreConfig, User, AuthRepositoryImpl, Injectable, StoreConfigRepositoryImpl, Injectable (+10 more)

### Community 34 - "f0_generate_sp_inventory.js"
Cohesion: 0.17
Nodes (10): BACKEND_SPS, backendOrder, byCat, fs, fusion, path, purpose, root (+2 more)

### Community 35 - "main.ts"
Cohesion: 0.19
Nodes (9): Catch, AppModule, Module, DomainErrorFilter, bootstrap(), decryptEnv(), loadEncryptedEnv(), loadNormalEnv() (+1 more)

### Community 36 - "1. Cumplimiento de principios"
Cohesion: 0.20
Nodes (9): 1. Cumplimiento de principios, 2. Pruebas, 3. Comandos, 4. Recomendaciones (roadmap), Análisis de calidad — Backend Prisma, Arquitectura Hexagonal — 80%, Clean Code, KISS (+1 more)

### Community 37 - "README.md"
Cohesion: 0.14
Nodes (13): 1. Obtener un token, 2. Usar el token, 3. Variables de entorno requeridas, Autenticación JWT, Compile and run the project, Deployment, Description, License (+5 more)

### Community 38 - "dispensers.service.ts"
Cohesion: 0.07
Nodes (25): buildMockPumpTransactions(), FALLBACK_HOSES, formatDate(), formatTime(), AuthorizePumpCommand, DispensersService, FusionSaleRow, HoseFSFullRow (+17 more)

### Community 39 - ".createInvoice"
Cohesion: 0.43
Nodes (3): Body, HttpCode, Post

### Community 40 - "shift.module.ts"
Cohesion: 0.15
Nodes (14): CloseFusionShiftCommand, FusionPeriodStatusResponse, FusionShiftCloseResponse, ShiftService, Inject, Injectable, CloseShiftUseCase, Injectable (+6 more)

### Community 41 - "CloseShiftDto"
Cohesion: 0.19
Nodes (8): Body, HttpCode, Post, CloseShiftDto, IsNotEmpty, IsNumber, IsOptional, IsString

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
Nodes (9): eslint, devDependencies, eslint, prisma, source-map-support, supertest, prisma, source-map-support (+1 more)

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
Cohesion: 0.07
Nodes (18): BenchmarkCase, benchmarks, discountService, failed, fuelCalculator, invoicePricing, rows, valueToLetters (+10 more)

### Community 51 - "mssql.d.ts"
Cohesion: 0.25
Nodes (4): Config, IConnectionPool, IRequest, mssql

### Community 52 - "InvoiceLealProcessor"
Cohesion: 0.17
Nodes (6): InvoiceLealProcessor, LealOperationResult, Inject, Injectable, Inject, CreditNoteInput

### Community 53 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 54 - "overrides"
Cohesion: 0.33
Nodes (6): overrides, body-parser, glob, multer, rimraf, uuid

### Community 55 - "run_secure.js"
Cohesion: 0.40
Nodes (5): askMasterKey(), main(), path, readline, { spawn }

### Community 56 - "CheckLealStatusUseCase"
Cohesion: 0.20
Nodes (5): CheckLealStatusUseCase, Injectable, RegisterLealCustomerUseCase, Injectable, Inject

### Community 58 - "create_test_user.js"
Cohesion: 0.50
Nodes (4): { Client }, crypto, hashPassword(), main()

### Community 59 - "AppService"
Cohesion: 0.30
Nodes (5): AppController, Controller, Get, AppService, Injectable

### Community 60 - "invoice-repository.ts"
Cohesion: 0.33
Nodes (4): LockedSeriesRow, lockSeriesForUpdate(), nextInvoiceNumber(), nextTrId()

### Community 65 - "pg.d.ts"
Cohesion: 0.29
Nodes (3): pg, Pool, PoolConfig

### Community 76 - "OpenShiftDto"
Cohesion: 0.33
Nodes (5): OpenShiftDto, IsNotEmpty, IsNumber, IsOptional, IsString

### Community 80 - "invoices/invoices.controller.spec.ts"
Cohesion: 0.40
Nodes (4): CreditNoteDto, IsNotEmpty, IsOptional, IsString

## Knowledge Gaps
- **313 isolated node(s):** `fs`, `path`, `crypto`, `readline`, `$schema` (+308 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `products.module.ts`, `AuthRepositoryImpl`, `padStoreId`, `Customer`, `pg.d.ts`, `payment.module.ts`, `shift-repository.ts`, `app.module.ts`, `LealRepositoryImpl`, `MediaController`, `DispenserRepositoryImpl`, `invoice-repository.ts`, `SorteosRepositoryImpl`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `LealController` connect `LealController` to `CheckLealStatusUseCase`, `leal.controller.ts`, `app.module.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `InvoiceRepositoryImpl` connect `InvoiceRepositoryImpl` to `padStoreId`, `app.module.ts`, `benchmark.ts`, `PrismaService`, `invoice-repository.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `crypto` to the rest of the system?**
  _313 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `products.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.062456140350877196 - nodes in this community are weakly interconnected._
- **Should `padStoreId` be split into smaller, more focused modules?**
  _Cohesion score 0.14761904761904762 - nodes in this community are weakly interconnected._
- **Should `Customer` be split into smaller, more focused modules?**
  _Cohesion score 0.062003968253968256 - nodes in this community are weakly interconnected._