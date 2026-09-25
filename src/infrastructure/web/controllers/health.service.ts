import { Injectable, Optional } from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeControllerUrl } from '../../../utils/controller-url';
import { validateLicense, licensePaths } from '../../licensing/license';

import {
  CloudSyncService,
  CloudSyncStatus,
} from '../../../application/services/cloud-sync.service';

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded' | 'not_configured' | 'bypassed' | 'active' | 'unlicensed';
  latencyMs?: number;
  url?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface SystemMetrics {
  uptimeSeconds: number;
  memoryRssMb: number;
  memoryHeapUsedMb: number;
  timestamp: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  database: ComponentHealth;
  controller: ComponentHealth;
  licensing: ComponentHealth;
  system: SystemMetrics;
  cloudSync?: CloudSyncStatus;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cloudSyncService?: CloudSyncService,
  ) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const [dbHealth, controllerHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkController(),
    ]);

    const licensingHealth = this.checkLicensing();
    const system = this.getSystemMetrics();
    const cloudSync = this.cloudSyncService?.getSyncStatus();

    let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';

    if (dbHealth.status === 'down') {
      overallStatus = 'error';
    } else if (
      controllerHealth.status === 'down' ||
      licensingHealth.status === 'unlicensed'
    ) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      database: dbHealth,
      controller: controllerHealth,
      licensing: licensingHealth,
      system,
      cloudSync,
    };
  }

  async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Database unavailable';
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: errorMessage,
      };
    }
  }

  async checkController(): Promise<ComponentHealth> {
    const controllerUrl = await this.resolveControllerUrl();
    if (!controllerUrl) {
      return { status: 'not_configured' };
    }

    const start = Date.now();
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), 1500);
    try {
      let res: Response | null = null;
      try {
        res = await fetch(`${controllerUrl}/api/version`, {
          signal: abortController.signal,
        });
      } catch (err) {
        if (abortController.signal.aborted) throw err;
        res = await fetch(`${controllerUrl}/`, {
          signal: abortController.signal,
        });
      }

      const isUp = res && (res.ok || res.status < 500);
      return {
        status: isUp ? 'up' : 'down',
        latencyMs: Date.now() - start,
        url: controllerUrl,
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        url: controllerUrl,
        error: isTimeout
          ? 'Timeout (1.5s)'
          : err instanceof Error
            ? err.message
            : 'Unreachable',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  checkLicensing(): ComponentHealth {
    if (
      process.env.WAYNE_SKIP_LICENSE === 'true' &&
      process.env.NODE_ENV !== 'production'
    ) {
      return { status: 'bypassed' };
    }

    try {
      const paths = licensePaths();
      const result = validateLicense(paths.license);
      if (result.ok) {
        let details: Record<string, unknown> | undefined;
        try {
          if (fs.existsSync(paths.license)) {
            const raw = JSON.parse(fs.readFileSync(paths.license, 'utf8'));
            details = {
              issuedTo: raw.issuedTo,
              expiresUtc: raw.expiresUtc,
              machineId: result.machineId,
            };
          }
        } catch {
          // ignore
        }
        return {
          status: 'active',
          details,
        };
      }
      return {
        status: 'unlicensed',
        error: result.error,
      };
    } catch (err: unknown) {
      return {
        status: 'unlicensed',
        error: err instanceof Error ? err.message : 'License check failed',
      };
    }
  }

  getSystemMetrics(): SystemMetrics {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  private async resolveControllerUrl(): Promise<string | null> {
    let raw: string | null = null;
    try {
      const store = await this.prisma.tienda.findFirst();
      if (store?.urlControlador?.trim()) {
        raw = store.urlControlador.trim();
      }
    } catch {
      // Fallback si la base de datos no está accesible aún
    }

    if (!raw) {
      raw = process.env.WAYNE_API_URL?.trim() || null;
    }

    if (!raw) return null;
    return normalizeControllerUrl(raw);
  }
}
