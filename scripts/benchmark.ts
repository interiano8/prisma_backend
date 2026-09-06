import { performance } from 'node:perf_hooks';
import { ValueToLettersService } from '../src/domain/services/value-to-letters.service';
import { FuelCalculatorService } from '../src/domain/services/fuel-calculator.service';
import { DiscountService } from '../src/domain/services/discount.service';
import { InvoicePricingService } from '../src/domain/services/invoice-pricing.service';
import { serverNow, toServerIso } from '../src/utils/datetime';

interface BenchmarkCase {
  name: string;
  run: () => void;
  minOpsPerSec: number;
}

const ITERATIONS = 1_000_000;
const WARMUP = 10_000;

const valueToLetters = new ValueToLettersService();
const fuelCalculator = new FuelCalculatorService();
const discountService = new DiscountService();
const invoicePricing = new InvoicePricingService();

const benchmarks: BenchmarkCase[] = [
  {
    name: 'value-to-letters.convert(1523.45)',
    minOpsPerSec: 150_000,
    run: () => valueToLetters.convert(1523.45),
  },
  {
    name: 'fuel-calculator.calculateFuelAmount',
    minOpsPerSec: 50_000_000,
    run: () => fuelCalculator.calculateFuelAmount(12.345, 38.9),
  },
  {
    name: 'fuel-calculator.calculateVolume',
    minOpsPerSec: 50_000_000,
    run: () => fuelCalculator.calculateVolume(500, 38.9),
  },
  {
    name: 'discount.evaluateBestRule (porcentaje)',
    minOpsPerSec: 80_000_000,
    run: () =>
      discountService.evaluateBestRule(
        [
          {
            id: 'R1',
            tipoBeneficio: 'PORCENTAJE',
            valor: 2.5,
            prioridad: 0,
          },
        ],
        5,
        38.9,
        'IVA15',
      ),
  },
  {
    name: 'invoice-pricing.calculateLineTotal',
    minOpsPerSec: 80_000_000,
    run: () =>
      invoicePricing.calculateLineTotal({
        code: 'P001',
        description: 'Gasolina Regular',
        qty: 3,
        price: 152.5,
        tax: 68.62,
        discount: 10,
        total: 516.12,
      }),
  },
  {
    name: 'invoice-pricing.calculateVatAmount',
    minOpsPerSec: 80_000_000,
    run: () => invoicePricing.calculateVatAmount(115, 15),
  },
  {
    name: 'datetime.toServerIso(now)',
    minOpsPerSec: 500_000,
    run: () => toServerIso(serverNow()),
  },
];

function measure(fn: () => void): { opsPerSec: number; totalMs: number } {
  for (let i = 0; i < WARMUP; i++) fn();
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const totalMs = performance.now() - start;
  return { opsPerSec: (ITERATIONS / totalMs) * 1000, totalMs };
}

console.log(
  `Benchmark: ${ITERATIONS.toLocaleString('en-US')} iteraciones por caso\n`,
);
const rows: Array<{ name: string; opsPerSec: number; totalMs: number }> = [];
for (const bench of benchmarks) {
  const result = measure(bench.run);
  rows.push({ name: bench.name, ...result });
}

const width = rows.reduce((max, r) => Math.max(max, r.name.length), 0) + 4;
console.log('Caso'.padEnd(width) + '  ops/seg        tiempo   umbral');
const failed: string[] = [];
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const min = benchmarks[i].minOpsPerSec;
  const ok = row.opsPerSec >= min;
  if (!ok) failed.push(row.name);
  console.log(
    `${row.name.padEnd(width)}  ${row.opsPerSec.toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(13)}  ${row.totalMs.toFixed(1).padStart(6)} ms  ${min.toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(11)} ${ok ? 'OK' : 'FAIL'}`,
  );
}

if (failed.length > 0) {
  console.error(`\nUmbral de rendimiento no alcanzado en:\n- ${failed.join('\n- ')}`);
  process.exit(1);
}
console.log('\nTodos los casos superan su umbral de rendimiento.');

