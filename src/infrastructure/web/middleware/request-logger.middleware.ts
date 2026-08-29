import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId = this.resolveRequestId(req);

    res.setHeader('x-request-id', requestId);
    this.logger.log(
      `[${requestId}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`,
    );

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      this.logger.log(
        `[${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs} ms)`,
      );
    });

    next();
  }

  private resolveRequestId(req: Request): string {
    const header = req.header('x-request-id');
    if (header && header.trim() !== '') return header.trim();
    return randomUUID();
  }
}
