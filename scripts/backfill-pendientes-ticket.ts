import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InvoicesService } from '../src/application/services/invoices.service';
import { PrismaService } from '../src/prisma/prisma.service';

const EMPLOYEE_BY_POS: Record<string, string> = {
  '01': 'prueba',
  '02': 'TEST',
  '03': 'NICOL M',
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const invoices = app.get(InvoicesService);
  const prisma = app.get(PrismaService);

  const pendings: any[] =
    (await (prisma as any).ventaCombustible?.findMany?.({
      where: { facturada: false },
      select: { idVenta: true, numeroBomba: true },
    })) ?? [];

  const unique = new Map<number, number>();
  for (const p of pendings) unique.set(p.idVenta, p.numeroBomba ?? 0);

  console.log(`Pendientes únicos: ${unique.size}`);

  for (const [saleId, pump] of unique) {
    const hose = await prisma.manguera.findFirst({
      where: { idBomba: pump },
      select: { pos: true },
    });
    const posNo = hose?.pos || '01';
    const employeeName = EMPLOYEE_BY_POS[posNo] || 'TEST';
    try {
      const r = await invoices.createTicketForPendingSale(saleId, {
        storeId: '001',
        posNo,
        shiftNumber: '0',
        employeeName,
        customerNo: 'CF',
        customerName: 'CONSUMIDOR FINAL',
      });
      console.log(`OK #${saleId} pos=${posNo} -> ${r.invoiceNo}`);
    } catch (e: any) {
      console.error(`FAIL #${saleId} pos=${posNo}: ${e?.message}`);
      if (!e?.message) console.error((e as any)?.stack || e);
    }
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});