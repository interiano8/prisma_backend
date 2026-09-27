import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TokenService } from '../infrastructure/security/token.service';
import { JwtAuthGuard } from '../infrastructure/web/guards/jwt-auth.guard';
import { AdminGuard } from '../infrastructure/web/guards/admin.guard';
import { TOKEN_PORT } from '../domain/ports/out/token.interface';
import { RbacService } from '../infrastructure/security/rbac/rbac.service';
import { PermissionsGuard } from '../infrastructure/security/rbac/permissions.guard';

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: TOKEN_PORT, useClass: TokenService },
    JwtAuthGuard,
    AdminGuard,
    RbacService,
    PermissionsGuard,
  ],
  exports: [
    PrismaService,
    TOKEN_PORT,
    JwtAuthGuard,
    AdminGuard,
    RbacService,
    PermissionsGuard,
  ],
})
export class PrismaModule {}