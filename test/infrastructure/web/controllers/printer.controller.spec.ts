import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { PrinterController } from '../../../../src/infrastructure/web/controllers/printer.controller';
import { TOKEN_PORT } from '../../../../src/domain/ports/out/token.interface';
import { JwtAuthGuard } from '../../../../src/infrastructure/web/guards/jwt-auth.guard';
import { AdminGuard } from '../../../../src/infrastructure/web/guards/admin.guard';
import { PrinterService } from '../../../../src/infrastructure/printing/printer.service';

describe('PrinterController', () => {
  let controller: PrinterController;
  let service: { printRaw: jest.Mock; savePrinterConfig: jest.Mock };

  beforeEach(async () => {
    service = { printRaw: jest.fn(), savePrinterConfig: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrinterController],
      providers: [
        { provide: PrinterService, useValue: service },
        { provide: TOKEN_PORT, useValue: { sign: jest.fn(), verify: jest.fn() } },
        JwtAuthGuard,
        AdminGuard,
      ],
    }).compile();

    controller = module.get(PrinterController);
  });

  it('printReceipt imprime y devuelve éxito', async () => {
    service.printRaw.mockResolvedValue(undefined);

    await expect(
      controller.printReceipt({ printerPath: 'P', bytesBase64: 'abc' }),
    ).resolves.toEqual({ success: true, message: 'Printed successfully' });
  });

  it('printReceipt rechaza si faltan campos', async () => {
    await expect(
      controller.printReceipt({ printerPath: '', bytesBase64: '' }),
    ).rejects.toThrow(HttpException);
    expect(service.printRaw).not.toHaveBeenCalled();
  });

  it('printReceipt lanza 500 si la impresión falla', async () => {
    service.printRaw.mockRejectedValue(new Error('boom'));

    await expect(
      controller.printReceipt({ printerPath: 'P', bytesBase64: 'abc' }),
    ).rejects.toThrow('Printing failed: boom');
  });

  it('printReceipt serializa errores que no son Error', async () => {
    service.printRaw.mockRejectedValue('strange');

    await expect(
      controller.printReceipt({ printerPath: 'P', bytesBase64: 'abc' }),
    ).rejects.toThrow(HttpException);
  });

  it('saveConfig guarda y devuelve éxito', async () => {
    service.savePrinterConfig.mockResolvedValue(undefined);

    await expect(
      controller.saveConfig({ posNo: '01', printerConfig: { a: 1 } }),
    ).resolves.toEqual({
      success: true,
      message: 'Printer config saved successfully',
    });
  });

  it('saveConfig rechaza si faltan campos', async () => {
    await expect(controller.saveConfig({ posNo: '' })).rejects.toThrow(
      HttpException,
    );
    expect(service.savePrinterConfig).not.toHaveBeenCalled();
  });

  it('saveConfig lanza 500 si el guardado falla', async () => {
    service.savePrinterConfig.mockRejectedValue('error-no-Error');

    await expect(
      controller.saveConfig({ posNo: '01', printerConfig: { a: 1 } }),
    ).rejects.toThrow(HttpException);
  });

  it('saveConfig lanza 500 con Error', async () => {
    service.savePrinterConfig.mockRejectedValue(new Error('db down'));

    await expect(
      controller.saveConfig({ posNo: '01', printerConfig: { a: 1 } }),
    ).rejects.toThrow('Saving config failed: db down');
  });
});
