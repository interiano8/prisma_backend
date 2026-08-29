/*
 * Prueba de rendimiento básica: lanza N peticiones concurrentes a un endpoint
 * y reporta latencia mínima/máxima/promedio y errores.
 *
 * Uso: node scripts/perf_test.js [urlBase] [endpoint] [total] [concurrencia]
 * Ej.: node scripts/perf_test.js http://localhost:5009 /api/payment/methods 500 20
 */
const base = process.argv[2] || 'http://localhost:5009';
const endpoint = process.argv[3] || '/api/payment/methods';
const total = Number(process.argv[4] || 500);
const concurrency = Number(process.argv[5] || 20);

async function main() {
  const url = `${base}${endpoint}`;
  let done = 0;
  let errors = 0;
  const latencies = [];
  let min = Infinity;
  let max = -Infinity;

  const start = Date.now();

  async function worker() {
    while (done < total) {
      done++;
      const t0 = Date.now();
      try {
        const res = await fetch(url);
        if (!res.ok) errors++;
      } catch {
        errors++;
      }
      const ms = Date.now() - t0;
      latencies.push(ms);
      if (ms < min) min = ms;
      if (ms > max) max = ms;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const elapsed = Date.now() - start;
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log(`Endpoint: ${url}`);
  console.log(`Peticiones: ${total} | Concurrencia: ${concurrency}`);
  console.log(`Duración: ${elapsed} ms | throughput: ${((total / elapsed) * 1000).toFixed(1)} req/s`);
  console.log(`Latencia (ms): min=${min} max=${max} avg=${avg.toFixed(1)} p95=${p95} p99=${p99}`);
  console.log(`Errores: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
