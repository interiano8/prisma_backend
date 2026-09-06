# Graph Report - prisma_backend  (2026-08-15)

## Corpus Check
- 288 files · ~189,210 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1503 nodes · 2448 edges · 147 communities (62 shown, 85 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- products.module.ts
- InvoicesService
- InvoiceRepositoryImpl
- customers.module.ts
- GetDispenserStatusUseCase
- Tablas núcleo (migrar)
- f3_etl.js
- payment.module.ts
- DispensersService
- leal.controller.ts
- app.module.ts
- auth.module.ts
- compilerOptions
- FusionSyncService
- LealController
- shift.entity.ts
- LealRepositoryImpl
- domain-error.ts
- dependencies
- ShiftRepositoryImpl
- DispenserRepositoryImpl
- PosConfigService
- PrinterService
- CloseShiftDto
- f0_analyze.js
- Resto de SPs (por categoría)
- AdminUseCase
- printing.use-cases.spec.ts
- .getAvailableShifts
- dispenser-repository.ts
- PrismaService
- fusion-sync.module.ts
- scripts
- AuthRepositoryImpl
- f0_generate_sp_inventory.js
- AppService
- 1. Cumplimiento de principios
- README.md
- main.ts
- User
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
- StoreConfig
- nest-cli.json
- overrides
- run_secure.js
- auth-repository.ts
- @prisma/client
- create_test_user.js
- invoice-passthrough.use-cases.spec.ts
- GetTransactionsUseCase
- TokenService
- ReverseTransactionUseCase
- RequestLoggerMiddleware
- perf_test.js
- admin.use-cases.spec.ts
- class-validator
- eslint
- eslint-import-resolver-typescript
- eslint-plugin-import
- fix_shift.ts
- patch_invoices_backend.ts
- seed.ts
- test-check-shift-table.ts
- test_close.ts
- test_close2.ts
- test_close_manually.ts
- test_close_shift.ts
- test_count_cn.ts
- test_date.ts
- test_db.ts
- test_db10.ts
- test_db11.ts
- test_db12.ts
- test_db13.ts
- test_db2.ts
- test_db3.ts
- test_db4.ts
- test_db5.ts
- test_db6.ts
- test_db7.ts
- test_db8.ts
- test_db9.ts
- test_db_exist.ts
- test_db_sp.ts
- test_db_sp2.ts
- test_doc_3.ts
- test_doctypes.ts
- test_get_invoice.ts
- test_get_invoices.ts
- test-getShiftDetails.ts
- test-getShiftDetails-2.ts
- test-open-shifts.ts
- test_query.ts
- test-query.ts
- test_report.ts
- test-sales-report.ts
- test-shift.ts
- test_shift.ts
- test_sp.ts
- test_sp2.ts
- test_sp3.ts
- test_sp_close.ts
- test_sp_invoice.ts
- test_store.ts
- test_trans.ts
- test_trans2.ts
- eslint-config-prettier
- globals
- @eslint/js
- eslint-plugin-prettier
- jest
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- pg
- prettier
- jsonwebtoken
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
1. `PrismaService` - 32 edges
2. `@prisma/client` - 31 edges
3. `InvoiceRepositoryImpl` - 30 edges
4. `Tablas núcleo (migrar)` - 27 edges
5. `LealRepositoryImpl` - 23 edges
6. `compilerOptions` - 22 edges
7. `DispensersService` - 20 edges
8. `DispenserRepositoryImpl` - 20 edges
9. `InvoicesService` - 20 edges
10. `AuthRepositoryImpl` - 18 edges

## Surprising Connections (you probably didn't know these)
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  fix_shift.ts → package.json
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  test-check-shift-table.ts → package.json
- `run()` --references--> `@prisma/client`  [EXTRACTED]
  test_close_shift.ts → package.json
- `run()` --references--> `@prisma/client`  [EXTRACTED]
  test_db10.ts → package.json
- `run()` --references--> `@prisma/client`  [EXTRACTED]
  test_db11.ts → package.json

## Import Cycles
- None detected.

## Communities (147 total, 85 thin omitted)

### Community 0 - "products.module.ts"
Cohesion: 0.06
Nodes (24): GetProductDiscountUseCase, Injectable, GetProductUseCase, Injectable, ListProductsUseCase, Injectable, Discount, Product (+16 more)

### Community 1 - "InvoicesService"
Cohesion: 0.05
Nodes (33): IsArray, CreateInvoiceDto, InvoiceItemDto, InvoicePaymentDto, LealPaymentData, IsNotEmpty, IsNumber, IsOptional (+25 more)

### Community 2 - "InvoiceRepositoryImpl"
Cohesion: 0.06
Nodes (13): CreateInvoiceUseCase, Injectable, CreateInvoiceCommand, Invoice, InvoicePayment, InvoiceItem, InvoiceUseCase, InvoicePricingService (+5 more)

### Community 3 - "customers.module.ts"
Cohesion: 0.07
Nodes (22): GetConsumidorFinalUseCase, Injectable, SearchCustomersUseCase, Injectable, CustomersController, Body, Controller, Get (+14 more)

### Community 4 - "GetDispenserStatusUseCase"
Cohesion: 0.16
Nodes (7): AuthorizePumpUseCase, Injectable, GetDispenserStatusUseCase, LocalDispenser, Injectable, AuthorizePumpCommand, DispenserStatus

### Community 5 - "Tablas núcleo (migrar)"
Cohesion: 0.05
Nodes (43): Catálogo/referencia (migrar), `Charge Method` → **metodos_pago** _(~14 filas)_, `Customer` → **clientes** _(~1066 filas)_, `Descuentos` → **descuentos** _(~132 filas)_, Diccionario de datos — migración TPV → PostgreSQL, `Employee` → **empleados** _(~29 filas)_, Fiscal (migrar), `FuelAttendant` → **despachadores** _(~10 filas)_ (+35 more)

### Community 6 - "f3_etl.js"
Cohesion: 0.08
Nodes (32): byCat, catLabels, fs, fusion, path, root, rowCounts, scope (+24 more)

### Community 7 - "payment.module.ts"
Cohesion: 0.08
Nodes (18): GetPaymentMethodsUseCase, Inject, Injectable, ProcessPaymentUseCase, Inject, Injectable, PaymentAllocation, PaymentMethod (+10 more)

### Community 8 - "DispensersService"
Cohesion: 0.07
Nodes (20): DispensersController, Body, Controller, Get, HttpCode, Param, Post, Query (+12 more)

### Community 9 - "leal.controller.ts"
Cohesion: 0.10
Nodes (19): AccumulatePointsUseCase, Injectable, CheckLealStatusUseCase, Injectable, LoginLealUseCase, Injectable, RedeemPointsUseCase, Injectable (+11 more)

### Community 10 - "app.module.ts"
Cohesion: 0.15
Nodes (17): Global, AuthModule, Module, CustomersModule, Module, DispensersModule, Module, LealModule (+9 more)

### Community 11 - "auth.module.ts"
Cohesion: 0.06
Nodes (35): LoginRfidUseCase, Injectable, LoginUseCase, Injectable, AuthController, Body, Controller, Get (+27 more)

### Community 12 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 13 - "FusionSyncService"
Cohesion: 0.25
Nodes (3): FusionSyncService, Inject, Injectable

### Community 14 - "LealController"
Cohesion: 0.19
Nodes (9): Headers, LealController, Body, Controller, Get, Param, Post, Put (+1 more)

### Community 15 - "shift.entity.ts"
Cohesion: 0.26
Nodes (6): CloseShiftCommand, OpenShiftCommand, ShiftInfo, ShiftUseCase, serverNow(), toServerIso()

### Community 16 - "LealRepositoryImpl"
Cohesion: 0.08
Nodes (17): LealAccumulatePointsRequest, LealCustomer, LealLoginRequest, LealLoginResponse, LealRedeemPointsRequest, LealRegisterCustomerRequest, LealReverseTransactionRequest, LealSearchCustomerRequest (+9 more)

### Community 17 - "domain-error.ts"
Cohesion: 0.26
Nodes (11): Catch, BadRequestDomainError, ConflictDomainError, DomainError, ForbiddenDomainError, InternalDomainError, NotFoundDomainError, UnauthorizedDomainError (+3 more)

### Community 18 - "dependencies"
Cohesion: 0.12
Nodes (17): class-transformer, helmet, mssql, @nestjs/common, @nestjs/core, @nestjs/platform-express, dependencies, class-transformer (+9 more)

### Community 19 - "ShiftRepositoryImpl"
Cohesion: 0.19
Nodes (4): Shift, padStoreId(), ShiftRepositoryImpl, Injectable

### Community 21 - "PosConfigService"
Cohesion: 0.15
Nodes (10): PosConfigController, Body, Controller, Get, Param, Put, PosConfigData, PosConfigService (+2 more)

### Community 22 - "PrinterService"
Cohesion: 0.11
Nodes (10): PrinterController, Body, Controller, Post, PrinterModule, Module, PrinterService, Inject (+2 more)

### Community 23 - "CloseShiftDto"
Cohesion: 0.13
Nodes (13): CloseShiftDto, IsNotEmpty, IsNumber, IsOptional, IsString, OpenShiftDto, IsNotEmpty, IsNumber (+5 more)

### Community 24 - "f0_analyze.js"
Cohesion: 0.12
Nodes (15): allTables, BACKEND_SPS, direct, fs, fusion, fusionProcByName, output, path (+7 more)

### Community 25 - "Resto de SPs (por categoría)"
Cohesion: 0.12
Nodes (15): Clientes/empleados/autenticación, Consulta de ventas/reimpresión, Correlativos y totales (cierre/reporte), Cálculo ISV/descuento, resumen y Leal, Extracción BCPOS/Fusion, FusionController, Importación de datos maestros, Inserción de ventas/pagos (+7 more)

### Community 27 - "printing.use-cases.spec.ts"
Cohesion: 0.09
Nodes (14): PrintFusionCloseUseCase, Injectable, PrintInvoiceUseCase, Injectable, PrintSalesReportUseCase, Injectable, PrintTicketUseCase, Injectable (+6 more)

### Community 29 - "dispenser-repository.ts"
Cohesion: 0.27
Nodes (3): HoseConfig, PumpTransaction, DispenserUseCase

### Community 30 - "PrismaService"
Cohesion: 0.15
Nodes (4): PosConfigRepositoryImpl, Injectable, PrismaService, Injectable

### Community 31 - "fusion-sync.module.ts"
Cohesion: 0.23
Nodes (6): FusionSyncController, Controller, Get, FusionSyncModule, Module, FusionSaleRow

### Community 32 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, build, format, lint, start, start:debug, start:dev, start:prod (+8 more)

### Community 34 - "f0_generate_sp_inventory.js"
Cohesion: 0.17
Nodes (10): BACKEND_SPS, backendOrder, byCat, fs, fusion, path, purpose, root (+2 more)

### Community 35 - "AppService"
Cohesion: 0.29
Nodes (5): AppController, Controller, Get, AppService, Injectable

### Community 36 - "1. Cumplimiento de principios"
Cohesion: 0.20
Nodes (9): 1. Cumplimiento de principios, 2. Pruebas, 3. Comandos, 4. Recomendaciones (roadmap), Análisis de calidad — Backend Prisma, Arquitectura Hexagonal — 80%, Clean Code, KISS (+1 more)

### Community 37 - "README.md"
Cohesion: 0.14
Nodes (13): 1. Obtener un token, 2. Usar el token, 3. Variables de entorno requeridas, Autenticación JWT, Compile and run the project, Deployment, Description, License (+5 more)

### Community 38 - "main.ts"
Cohesion: 0.24
Nodes (7): AppModule, Module, bootstrap(), decryptEnv(), loadEncryptedEnv(), loadNormalEnv(), ENV_ENC

### Community 39 - "User"
Cohesion: 0.29
Nodes (3): ManageUsersUseCase, Injectable, User

### Community 40 - "shift.module.ts"
Cohesion: 0.12
Nodes (13): CloseShiftUseCase, Injectable, GetShiftStatusUseCase, Injectable, OpenShiftUseCase, Injectable, ShiftController, Controller (+5 more)

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
Nodes (9): @eslint/eslintrc, devDependencies, @eslint/eslintrc, prisma, source-map-support, supertest, prisma, source-map-support (+1 more)

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
Cohesion: 0.11
Nodes (9): BenchmarkCase, benchmarks, discountService, fuelCalculator, invoicePricing, rows, valueToLetters, FuelCalculatorService (+1 more)

### Community 51 - "mssql.d.ts"
Cohesion: 0.25
Nodes (4): Config, IConnectionPool, IRequest, mssql

### Community 52 - "StoreConfig"
Cohesion: 0.23
Nodes (3): StoreConfig, StoreConfigRepositoryImpl, Injectable

### Community 53 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 54 - "overrides"
Cohesion: 0.29
Nodes (7): overrides, body-parser, glob, js-yaml, multer, rimraf, uuid

### Community 55 - "run_secure.js"
Cohesion: 0.40
Nodes (5): askMasterKey(), main(), path, readline, { spawn }

### Community 56 - "auth-repository.ts"
Cohesion: 0.27
Nodes (3): verifyPasswordHash(), IdentityPasswordHasher, Injectable

### Community 57 - "@prisma/client"
Cohesion: 0.40
Nodes (4): @prisma/client, @prisma/client, main(), prisma

### Community 58 - "create_test_user.js"
Cohesion: 0.50
Nodes (4): { Client }, crypto, hashPassword(), main()

### Community 59 - "invoice-passthrough.use-cases.spec.ts"
Cohesion: 0.14
Nodes (6): CreditNoteUseCase, Injectable, ListInvoicesUseCase, Injectable, ReprintInvoiceUseCase, Injectable

### Community 65 - "admin.use-cases.spec.ts"
Cohesion: 0.18
Nodes (6): ManageAdminPasswordUseCase, Injectable, ManageShiftsConfigUseCase, Injectable, Injectable, UpdateStoreConfigUseCase

## Knowledge Gaps
- **338 isolated node(s):** `fs`, `path`, `crypto`, `readline`, `prisma` (+333 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **85 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaModule` connect `app.module.ts` to `products.module.ts`, `customers.module.ts`, `payment.module.ts`, `shift.module.ts`, `auth.module.ts`, `PrinterService`, `fusion-sync.module.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `products.module.ts`, `AuthRepositoryImpl`, `InvoiceRepositoryImpl`, `customers.module.ts`, `payment.module.ts`, `SorteosRepositoryImpl`, `app.module.ts`, `shift.entity.ts`, `LealRepositoryImpl`, `ShiftRepositoryImpl`, `StoreConfig`, `auth-repository.ts`, `dispenser-repository.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `InvoiceRepositoryImpl` connect `InvoiceRepositoryImpl` to `app.module.ts`, `PrismaService`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `crypto` to the rest of the system?**
  _338 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `products.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.059237319511292116 - nodes in this community are weakly interconnected._
- **Should `InvoicesService` be split into smaller, more focused modules?**
  _Cohesion score 0.05242566510172144 - nodes in this community are weakly interconnected._
- **Should `InvoiceRepositoryImpl` be split into smaller, more focused modules?**
  _Cohesion score 0.06412583182093164 - nodes in this community are weakly interconnected._