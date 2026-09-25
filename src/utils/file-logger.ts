import * as fs from 'fs';
import * as path from 'path';

export interface FileLoggerOptions {
  logDir?: string;
  maxFileSizeBytes?: number;
  maxRetentionDays?: number;
}

export class FileLogger {
  private logDir: string;
  private maxFileSizeBytes: number;
  private maxRetentionDays: number;
  private lastPruneDate: string = '';

  constructor(options?: FileLoggerOptions) {
    this.logDir = options?.logDir || process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    // Default: 10 MB
    this.maxFileSizeBytes = options?.maxFileSizeBytes || 10 * 1024 * 1024;
    // Default: 14 days
    this.maxRetentionDays = options?.maxRetentionDays || 14;

    this.ensureLogDir();
  }

  ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('[FileLogger] Error creando directorio de logs:', err);
    }
  }

  formatDate(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getLogFilePath(date: Date = new Date()): string {
    const dateStr = this.formatDate(date);
    const baseName = `prisma-backend-${dateStr}`;
    let candidatePath = path.join(this.logDir, `${baseName}.log`);

    try {
      let index = 1;
      while (fs.existsSync(candidatePath)) {
        const stats = fs.statSync(candidatePath);
        if (stats.size < this.maxFileSizeBytes) {
          return candidatePath;
        }
        candidatePath = path.join(this.logDir, `${baseName}.${index}.log`);
        index++;
      }
    } catch {
      // Fallback
    }

    return candidatePath;
  }

  writeLog(message: string, level: string = 'INFO'): void {
    const now = new Date();
    const dateStr = this.formatDate(now);

    // Prune old logs once a day
    if (this.lastPruneDate !== dateStr) {
      this.pruneOldLogs();
      this.lastPruneDate = dateStr;
    }

    const timestamp = now.toISOString();
    const formattedLine = `[${timestamp}] [${level.toUpperCase()}] ${message.trim()}\n`;

    try {
      const filePath = this.getLogFilePath(now);
      fs.appendFileSync(filePath, formattedLine, 'utf8');
    } catch (err) {
      console.error('[FileLogger] Error escribiendo log a disco:', err);
    }
  }

  pruneOldLogs(maxDays: number = this.maxRetentionDays): number {
    try {
      if (!fs.existsSync(this.logDir)) return 0;

      const now = Date.now();
      const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(this.logDir);
      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith('prisma-backend-') || !file.endsWith('.log')) {
          continue;
        }

        const fullPath = path.join(this.logDir, file);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        } catch {
          // Ignorar archivos que no puedan leerse o eliminarse
        }
      }

      return deletedCount;
    } catch (err) {
      console.error('[FileLogger] Error podando logs antiguos:', err);
      return 0;
    }
  }
}

export const defaultFileLogger = new FileLogger();
