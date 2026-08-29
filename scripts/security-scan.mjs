#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const SECRET_PATTERNS = [
  {
    name: 'contraseña administrador hardcodeada',
    regex: /(?:password|pass|clave|secret|token)\s*[=:]\s*['"][^'"]{4,}['"]/i,
  },
  {
    name: 'clave privada / certificado',
    regex: /BEGIN (?:RSA |EC |DSA )?PRIVATE KEY/,
  },
  {
    name: 'clave API',
    regex:
      /(?:api[_-]?key|apikey|client[_-]?secret)\s*[=:]\s*['"][^'"]{8,}['"]/i,
  },
  {
    name: 'comparación de contraseña con literal',
    regex: /(?:password|pass|clave|pin)\s*(?:===|==)\s*['"][^'"]{4,}['"]/i,
  },
  { name: 'token JWT placeholder inseguro', regex: /jwt-token-for-/i },
  {
    name: 'URI con credenciales',
    regex: /(?:mysql|postgres|mongodb)(?:\+srv)?:\/\/[^:/\s]+:[^@/\s]+@/i,
  },
];

const fileExtensions = new Set(['.ts', '.js', '.mjs', '.json']);

function walk(dir, results) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (
      entry === 'node_modules' ||
      entry === 'coverage' ||
      entry === '.stryker-tmp' ||
      entry === 'dist'
    )
      continue;
    if (statSync(full).isDirectory()) {
      walk(full, results);
      continue;
    }
    if (fileExtensions.has(extname(full))) results.push(full);
  }
}

const files = [];
walk(SRC, files);

const findings = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const line of content.split('\n')) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({ file, line: line.trim(), pattern: pattern.name });
      }
    }
  }
}

if (findings.length === 0) {
  console.log('OK: no se detectaron secretos en el código fuente.');
  process.exit(0);
}

console.error(
  `SECUENCIA DE SEGURIDAD: se detectaron ${findings.length} posible(s) secreto(s):\n`,
);
for (const finding of findings) {
  console.error(`- [${finding.pattern}] ${finding.file}`);
  console.error(`    ${finding.line}`);
}
process.exit(1);
