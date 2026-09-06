import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PrinterController } from '../../src/infrastructure/web/controllers/printer.controller';
import { TOKEN_PORT } from '../../src/domain/ports/out/token.interface';
import { JwtAuthGuard } from '../../src/infrastructure/web/guards/jwt-auth.guard';
import { AdminGuard } from '../../src/infrastructure/web/guards/admin.guard';
import { PrinterService } from '../../src/infrastructure/printing/printer.service';

describe('PrinterController', () => {
  let controller: PrinterController;
  let mockService: { printRaw: jest.Mock; savePrinterConfig: jest.Mock };

  beforeEach(async () => {
    mockService = { printRaw: jest.fn(), savePrinterConfig: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrinterController],
      providers: [
        { provide: PrinterService, useValue: mockService },
        { provide: TOKEN_PORT, useValue: { sign: jest.fn(), verify: jest.fn() } },
        JwtAuthGuard,
        AdminGuard,
      ],
    }).compile();

    controller = module.get<PrinterController>(PrinterController);
  });

  it('rechaza sin printerPath', async () => {
    await expect(
      controller.printReceipt({ printerPath: '', bytesBase64: 'abc' }),
    ).rejects.toThrow(HttpException);
  });

  it('imprime correctamente', async () => {
    mockService.printRaw.mockResolvedValue(undefined);

    const result = await controller.printReceipt({
      printerPath: 'RECIBO',
      bytesBase64: 'abc',
    });

    expect(mockService.printRaw).toHaveBeenCalledWith('RECIBO', 'abc');
    expect(result.success).toBe(true);
  });

  it('devuelve 500 cuando falla la impresión', async () => {
    mockService.printRaw.mockRejectedValue(new Error('impresora ocupada'));

    await expect(
      controller.printReceipt({ printerPath: 'RECIBO', bytesBase64: 'abc' }),
    ).rejects.toThrow(HttpException);
  });

  it('rechaza saveConfig sin datos', async () => {
    await expect(
      controller.saveConfig({ posNo: '', printerConfig: undefined }),
    ).rejects.toThrow(
      new HttpException(
        'posNo and printerConfig are required',
        HttpStatus.BAD_REQUEST,
      ),
    );
  });

  it('guarda la configuración correctamente', async () => {
    mockService.savePrinterConfig.mockResolvedValue(undefined);

    const result = await controller.saveConfig({
      posNo: '01',
      printerConfig: { papel: '80mm' },
    });

    expect(mockService.savePrinterConfig).toHaveBeenCalledWith('01', {
      papel: '80mm',
    });
    expect(result.success).toBe(true);
  });
});
