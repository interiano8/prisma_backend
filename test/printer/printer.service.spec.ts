import { PrinterService } from '../../src/infrastructure/printing/printer.service';
import * as net from 'net';
import * as os from 'os';
import { exec } from 'child_process';
import type { PosConfigRepository } from '../../src/domain/ports/out/pos-config-repository.interface';

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    unlink: jest.fn(),
    promises: { ...actual.promises, writeFile: jest.fn() },
  };
});

jest.mock('os', () => {
  const actual = jest.requireActual<typeof import('os')>('os');
  return {
    ...actual,
    platform: jest.fn(() => 'linux'),
  };
});

import * as fs from 'fs';

class FakeSocket {
  errorHandler: ((e: Error) => void) | null = null;
  connect(port: number, host: string, cb: () => void) {
    void port;
    void host;
    cb();
    return this;
  }
  on(ev: string, cb: (...a: unknown[]) => void) {
    if (ev === 'error') this.errorHandler = cb;
    return this;
  }
  write(data: Buffer, cb: (e?: Error) => void) {
    void data;
    cb();
    return this;
  }
  end() {
    return this;
  }
}

jest.mock('net', () => ({ Socket: jest.fn() }));
jest.mock('child_process', () => ({ exec: jest.fn() }));

describe('PrinterService', () => {
  let service: PrinterService;
  let mockRepo: jest.Mocked<PosConfigRepository>;

  beforeEach(() => {
    mockRepo = { findByPos: jest.fn(), upsert: jest.fn() };
    service = new PrinterService(mockRepo);
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as unknown as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('imprime por TCP cuando la ruta parece una IP', async () => {
    (net.Socket as unknown as jest.Mock).mockImplementation(
      () => new FakeSocket(),
    );

    await service.printRaw(
      '192.168.1.100:9100',
      Buffer.from('data').toString('base64'),
    );

    expect(net.Socket).toHaveBeenCalled();
  });

  it('imprime vía Windows share en win32', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    (exec as unknown as jest.Mock).mockImplementation(
      (_cmd: string, cb: (e: Error | null) => void) => cb(null),
    );

    await service.printRaw(
      '\\\\PRINTER\\recibo',
      Buffer.from('data').toString('base64'),
    );

    expect(fs.promises.writeFile).toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('copy /B'),
      expect.any(Function),
    );
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('imprime vía CUPS (lpr) en linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (exec as unknown as jest.Mock).mockImplementation(
      (
        _cmd: string,
        cb: (e: Error | null, stdout?: string, stderr?: string) => void,
      ) => cb(null, 'printer1 accepting requests\n', ''),
    );

    await service.printRaw('RECIBO', Buffer.from('data').toString('base64'));

    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('lpr -P'),
      expect.any(Function),
    );
  });

  it('savePrinterConfig persiste la configuración', async () => {
    mockRepo.upsert.mockResolvedValue(undefined);

    await service.savePrinterConfig('01', { papel: '80mm' });

    expect(mockRepo.upsert).toHaveBeenCalledWith('01', {
      config: { papel: '80mm' },
    });
  });

  it('rechaza si la impresora TCP emite error', async () => {
    const socket = new FakeSocket();
    socket.connect = () => socket;
    (net.Socket as unknown as jest.Mock).mockImplementation(() => socket);

    const promise = service.printRaw(
      '192.168.1.100',
      Buffer.from('data').toString('base64'),
    );
    socket.errorHandler?.(new Error('ECONNREFUSED'));

    await expect(promise).rejects.toThrow('ECONNREFUSED');
  });

  it('rechaza si la escritura TCP falla', async () => {
    const socket = new FakeSocket();
    socket.write = (_data, cb) => {
      cb(new Error('write failed'));
      return socket;
    };
    (net.Socket as unknown as jest.Mock).mockImplementation(() => socket);

    const promise = service.printRaw(
      '192.168.1.100:9100',
      Buffer.from('data').toString('base64'),
    );

    await expect(promise).rejects.toThrow('write failed');
  });

  it('usa el puerto 9100 por defecto para IP sin puerto', async () => {
    let capturedPort: number | null = null;
    const socket = new FakeSocket();
    socket.connect = (port, _host, cb) => {
      capturedPort = port;
      cb();
      return socket;
    };
    (net.Socket as unknown as jest.Mock).mockImplementation(() => socket);

    await service.printRaw('10.0.0.1', Buffer.from('data').toString('base64'));

    expect(capturedPort).toBe(9100);
  });

  it('registra el error de exec sin rechazar la promesa', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    (exec as unknown as jest.Mock).mockImplementation(
      (
        _cmd: string,
        cb: (e: Error | null, stdout?: string, stderr?: string) => void,
      ) => cb(new Error('spawn failed'), '', 'err'),
    );
    const logSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => {});

    await expect(
      service.printRaw(
        '\\\\PRINTER\\recibo',
        Buffer.from('data').toString('base64'),
      ),
    ).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('resolveLinuxPrinterName devuelve el path en win32', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');

    await expect(
      (service as any).resolveLinuxPrinterName('PRINTER'),
    ).resolves.toBe('PRINTER');
  });

  it('resolveLinuxPrinterName resuelve la cola por printer-info', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (exec as unknown as jest.Mock).mockImplementation(
      (cmd: string, cb: (e: Error | null, stdout?: string) => void) => {
        if (cmd.startsWith('lpstat')) {
          cb(null, 'printer1 accepting requests\n');
        } else {
          cb(null, 'device for printer1: printer-info=RECIBO');
        }
      },
    );

    await expect(
      (service as any).resolveLinuxPrinterName('RECIBO'),
    ).resolves.toBe('printer1');
  });

  it('resolveLinuxPrinterName devuelve el path si lpoptions no coincide', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (exec as unknown as jest.Mock).mockImplementation(
      (cmd: string, cb: (e: Error | null, stdout?: string) => void) => {
        if (cmd.startsWith('lpstat')) {
          cb(null, 'printer1 accepting requests\n');
        } else {
          cb(null, 'device for printer1: printer-info=OTHER');
        }
      },
    );

    await expect(
      (service as any).resolveLinuxPrinterName('RECIBO'),
    ).resolves.toBe('RECIBO');
  });
});
