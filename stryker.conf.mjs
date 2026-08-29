// @ts-check
export default {
  packageManager: 'pnpm',
  reporters: ['clear-text', 'progress'],
  testRunner: 'jest',
  plugins: ['@stryker-mutator/jest-runner'],
  coverageAnalysis: 'perTest',
  // Alcance: lógica de negocio pura, casos de uso y errores de dominio.
  mutate: [
    'src/domain/services/**/*.ts',
    'src/utils/datetime.ts',
    'src/application/use-cases/**/*.ts',
    'src/domain/errors/**/*.ts',
    'src/infrastructure/web/filters/**/*.ts',
  ],
  jest: {
    configFile: 'jest.config.js',
    enableFindRelatedTests: true
  },
  thresholds: {
    high: 85,
    low: 60,
    break: 60
  }
}
