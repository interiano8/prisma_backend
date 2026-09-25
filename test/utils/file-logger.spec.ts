import * as fs from 'fs';
import * as path from 'path';
import { FileLogger } from '../../src/utils/file-logger';

describe('FileLogger', () => {
  const testLogDir = path.join(__dirname, '../../test-logs-tmp');

  beforeEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  it('debe crear el directorio de logs si no existe', () => {
    expect(fs.existsSync(testLogDir)).toBe(false);
    new FileLogger({ logDir: testLogDir });
    expect(fs.existsSync(testLogDir)).toBe(true);
  });

  it('debe escribir líneas formateadas con timestamp y nivel', () => {
    const logger = new FileLogger({ logDir: testLogDir });
    logger.writeLog('Mensaje de prueba', 'DEBUG');

    const files = fs.readdirSync(testLogDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^prisma-backend-\d{4}-\d{2}-\d{2}\.log$/);

    const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf8');
    expect(content).toContain('[DEBUG] Mensaje de prueba');
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T.*\]/);
  });

  it('debe rotar a un nuevo archivo cuando se supera el tamaño máximo', () => {
    // 50 bytes max file size
    const logger = new FileLogger({
      logDir: testLogDir,
      maxFileSizeBytes: 50,
    });

    logger.writeLog('Primer mensaje largo para llenar el archivo base');
    logger.writeLog('Segundo mensaje que debe ir en el archivo rotado .1');

    const files = fs.readdirSync(testLogDir).sort();
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.some((f) => f.includes('.1.log'))).toBe(true);
  });

  it('debe podar archivos con antigüedad mayor al umbral de retención', () => {
    const logger = new FileLogger({
      logDir: testLogDir,
      maxRetentionDays: 14,
    });

    const now = Date.now();
    const oldDateMs = now - 16 * 24 * 60 * 60 * 1000; // 16 días de antigüedad
    const recentDateMs = now - 5 * 24 * 60 * 60 * 1000; // 5 días de antigüedad

    const oldFile = path.join(testLogDir, 'prisma-backend-2026-09-01.log');
    const recentFile = path.join(testLogDir, 'prisma-backend-2026-09-20.log');
    const ignoredFile = path.join(testLogDir, 'not-a-log.txt');

    fs.writeFileSync(oldFile, 'log viejo');
    fs.utimesSync(oldFile, new Date(oldDateMs), new Date(oldDateMs));

    fs.writeFileSync(recentFile, 'log reciente');
    fs.utimesSync(recentFile, new Date(recentDateMs), new Date(recentDateMs));

    fs.writeFileSync(ignoredFile, 'otro archivo');

    const prunedCount = logger.pruneOldLogs(14);
    expect(prunedCount).toBe(1);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(recentFile)).toBe(true);
    expect(fs.existsSync(ignoredFile)).toBe(true);
  });
});
