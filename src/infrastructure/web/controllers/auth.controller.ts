import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginDto } from '../dto/auth/login.dto';
import { LoginRfidDto } from '../dto/auth/login-rfid.dto';
import { ValidateAdminDto } from '../dto/auth/validate-admin.dto';
import { LoginUseCase } from '../../../application/use-cases/auth/login.use-case';
import { LoginRfidUseCase } from '../../../application/use-cases/auth/login-rfid.use-case';
import { ValidateAdminUseCase } from '../../../application/use-cases/auth/validate-admin.use-case';
import { CheckCreditValidationUseCase } from '../../../application/use-cases/auth/check-credit-validation.use-case';
import { SavePreferencesUseCase } from '../../../application/use-cases/auth/save-preferences.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthRepository } from '../../../domain/ports/out/auth-repository.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly loginRfidUseCase: LoginRfidUseCase,
    private readonly validateAdminUseCase: ValidateAdminUseCase,
    private readonly checkCreditValidationUseCase: CheckCreditValidationUseCase,
    private readonly savePreferencesUseCase: SavePreferencesUseCase,
    @Inject('AuthRepository') private readonly authRepository: AuthRepository,
  ) {}

  @Get('employees')
  async listEmployees() {
    return this.authRepository.listEmployees();
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute({
      username: dto.username,
      password: dto.password,
      storeId: dto.storeId,
      posNo: dto.posNo,
    });
  }

  @Post('login-rfid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async loginRfid(@Body() dto: LoginRfidDto) {
    return this.loginRfidUseCase.execute({
      rfidCode: dto.rfidCode,
      storeId: dto.storeId,
      posNo: dto.posNo,
    });
  }

  @Post('validate-admin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async validateAdmin(@Body() dto: ValidateAdminDto) {
    return this.validateAdminUseCase.execute(dto);
  }

  @Get('check-credit-validation/:storeId')
  @UseGuards(JwtAuthGuard)
  async checkCreditValidation(@Param('storeId') storeId: string) {
    return this.checkCreditValidationUseCase.execute(storeId);
  }

  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  async savePreferences(
    @Body() body: { username: string; theme?: string; accent?: string },
  ) {
    return this.savePreferencesUseCase.execute(body.username, {
      theme: body.theme,
      accent: body.accent,
    });
  }
}
