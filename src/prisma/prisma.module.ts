import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TokenService } from '../infrastructure/security/token.service';
import { JwtAuthGuard } from '../infrastructure/web/guards/jwt-auth.guard';
import { AdminGuard } from '../infrastructure/web/guards/admin.guard';
import { TOKEN_PORT } from '../domain/ports/out/token.interface';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: TOKEN_PORT, useClass: TokenService },
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [
    PrismaService,
    TOKEN_PORT,
    JwtAuthGuard,
    AdminGuard,
  ],
})
export class PrismaModule {}