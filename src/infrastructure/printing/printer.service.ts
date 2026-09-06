import { Inject, Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as os from 'os';

import type { PosConfigRepository } from '../../domain/ports/out/pos-config-repository.interface';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  constructor(
    @Inject('PosConfigRepository')
    private readonly posConfigRepo: PosConfigRepository,
  ) {}

  async printRaw(printerPath: string, bytesBase64: string): Promise<void> {
    const buffer = Buffer.from(bytesBase64, 'base64');
    const isNetworkIP = this.looksLikeIp(printerPath);

    if (isNetworkIP) {
      return this.printToTcp(printerPath, buffer);
    } else {
      return this.printToWindowsShare(printerPath, buffer);
    }
  }

  private looksLikeIp(path: string): boolean {
    // Matches 192.168.1.100 or 192.168.1.100:9100
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]{1,5})?$/;
    return ipRegex.test(path);
  }

  private printToTcp(ipAndPort: string, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const parts = ipAndPort.split(':');
      const host = parts[0];
      const port = parts.length > 1 ? parseInt(parts[1], 10) : 9100;

      const client = new net.Socket();

      client.on('error', (err) => {
        this.logger.error(`TCP Print error to ${host}:${port}`, err);
        reject(err);
      });

      client.connect(port, host, () => {
        client.write(data, (err) => {
          if (err) {
            reject(err);
          } else {
            client.end();
            resolve();
          }
        });
      });
    });
  }

  private resolveLinuxPrinterName(printerPath: string): Promise<string> {
    return new Promise((resolve) => {
      const cleanPath = printerPath.trim();
      if (os.platform() === 'win32') {
        return resolve(cleanPath);
      }

      exec('lpstat -a', (err, stdout) => {
        if (err || !stdout) return resolve(cleanPath);

        const printers = stdout
          .split('\n')
          .map((line) => line.split(' ')[0])
          .filter((p) => p.trim() !== '');

        if (printers.length === 0) return resolve(cleanPath);

        let pending = printers.length;
        let found = false;

        for (const p of printers) {
          exec(`lpoptions -p "${p}"`, (errOpt, stdoutOpt) => {
            if (found) return;
            if (!errOpt && stdoutOpt) {
              if (
                stdoutOpt.includes(`printer-info=${cleanPath}`) ||
                stdoutOpt.includes(`printer-info='${cleanPath}'`) ||
                stdoutOpt.includes(`printer-info="${cleanPath}"`)
              ) {
                found = true;
                return resolve(p);
              }
            }
            pending--;
            if (pending === 0 && !found) {
              resolve(cleanPath);
            }
          });
        }
      });
    });
  }

  private async printToWindowsShare(
    printerPath: string,
    data: Buffer,
  ): Promise<void> {
    const tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
    await fs.promises.writeFile(tempFilePath, data);

    const isWindows = os.platform() === 'win32';
    const clean = (printerPath || '').trim().toLowerCase();
    const isDefault = clean === '' || clean === 'default';
    let command = '';

    if (isWindows) {
      if (isDefault) {
        // Impresora predeterminada de Windows
        command = `powershell -NoProfile -Command "Get-Content -LiteralPath '${tempFilePath}' -Encoding Byte | Out-Printer"`;
      } else if (printerPath.trim().startsWith('\\\\')) {
        command = `copy /B "${tempFilePath}" "${printerPath}"`;
      } else {
        // Impresora local USB/por nombre → Out-Printer (PowerShell)
        command = `powershell -NoProfile -Command "Get-Content -LiteralPath '${tempFilePath}' -Encoding Byte | Out-Printer -Name '${printerPath}'"`;
      }
    } else if (isDefault) {
      command = `lpr -o raw "${tempFilePath}"`;
    } else {
      const resolvedName = await this.resolveLinuxPrinterName(printerPath);
      this.logger.debug(
        `Resolved CUPS description "${printerPath}" to queue "${resolvedName}"`,
      );
      command = `lpr -P "${resolvedName}" -o raw "${tempFilePath}"`;
    }

    this.logger.debug(`Executing print command: ${command}`);

    return new Promise((resolve) => {
      exec(command, (execErr, stdout, stderr) => {
        fs.unlink(tempFilePath, () => {});
        if (execErr) {
          this.logger.error(`Exec print error: ${execErr.message} ${stderr}`);
        }
      });
      // Resolve immediately to avoid blocking the POS UI while CUPS spools the job
      resolve();
    });
  }

  async savePrinterConfig(
    posNo: string,
    printerConfig: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.posConfigRepo.upsert(posNo, { config: printerConfig });
  }

  async getPrinterConfig(posNo: string): Promise<unknown | null> {
    const pos = await this.posConfigRepo.findByPos(posNo);
    return pos?.config ?? null;
  }
}
