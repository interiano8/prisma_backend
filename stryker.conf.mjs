// @ts-check
export default {
  packageManager: 'pnpm',
  reporters: ['clear-text', 'progress', 'json'],
  testRunner: 'jest',
  plugins: ['@stryker-mutator/jest-runner'],
  coverageAnalysis: 'perTest',
  // Alcance: núcleo transaccional — facturación, correlativos, descuentos, cierre de turno.
  mutate: [
    'src/domain/services/discount.service.ts',
    'src/domain/services/fuel-calculator.service.ts',
    'src/domain/services/invoice-pricing.service.ts',
    'src/application/services/invoice-leal.processor.ts',
    'src/application/use-cases/payment/process-payment.use-case.ts',
    'src/application/use-cases/shift/close-shift.use-case.ts',
    'src/application/use-cases/shift/open-shift.use-case.ts',
    'src/application/use-cases/shift/get-shift-status.use-case.ts',
    'src/application/use-cases/product/calculate-cart-discounts.use-case.ts',
    'src/infrastructure/persistence/repositories/invoice-repository.ts',
    'src/infrastructure/persistence/repositories/shift-repository.ts',
    'src/infrastructure/persistence/repositories/payment-repository.ts',
  ],
  jest: {
    configFile: 'jest.config.js',
    enableFindRelatedTests: true
  },
  thresholds: {
    high: 85,
    low: 70,
    break: 80
  }
}
