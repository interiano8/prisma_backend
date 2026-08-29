import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  Headers,
  Inject,
} from '@nestjs/common';
import { LoginLealUseCase } from '../../../application/use-cases/leal/login-leal.use-case';
import { SearchLealCustomerUseCase } from '../../../application/use-cases/leal/search-leal-customer.use-case';
import { AccumulatePointsUseCase } from '../../../application/use-cases/leal/accumulate-points.use-case';
import { RedeemPointsUseCase } from '../../../application/use-cases/leal/redeem-points.use-case';
import { CheckLealStatusUseCase } from '../../../application/use-cases/leal/check-leal-status.use-case';
import { RegisterLealCustomerUseCase } from '../../../application/use-cases/leal/register-leal-customer.use-case';
import type { LealRepository } from '../../../domain/ports/out/leal-repository.interface';

interface LealApiData {
  [key: string]: unknown;
}

interface LoginLealBody {
  username?: string;
  password?: string;
  storeId?: string;
}

interface AccumulatePointsBody {
  uid?: string;
  customerId?: string;
  factura?: string;
  invoiceNo?: string;
  valor?: number;
  total?: number;
}

interface RedeemPointsBody {
  uid?: string;
  customerId?: string;
  puntos?: number;
  points?: number;
  factura?: string;
  invoiceNo?: string;
  idPremio?: number;
  id_premio?: number;
  otp?: string;
  OTP?: string;
  pin?: string;
  nota?: string;
}

interface GenerateOtpBody {
  uid?: string;
  idPremio?: number;
  id_premio?: number;
  idSucursal?: string;
  id_sucursal?: string;
}

interface RegisterCustomerBody {
  documentId?: string;
  name?: string;
  email?: string;
  phone?: string;
}

@Controller('leal')
export class LealController {
  constructor(
    private readonly loginLealUseCase: LoginLealUseCase,
    private readonly checkLealStatusUseCase: CheckLealStatusUseCase,
    private readonly searchLealCustomerUseCase: SearchLealCustomerUseCase,
    private readonly accumulatePointsUseCase: AccumulatePointsUseCase,
    private readonly redeemPointsUseCase: RedeemPointsUseCase,
    private readonly registerLealCustomerUseCase: RegisterLealCustomerUseCase,
    @Inject('LealRepository') private readonly lealRepository: LealRepository,
  ) {}

  @Post('login')
  async login(@Body() body: LoginLealBody) {
    // We allow missing username/password because LealRepositoryImpl auto-fetches them
    return this.loginLealUseCase.execute({
      username: body.username || '',
      password: body.password || '',
      storeId: body.storeId || '',
    });
  }

  @Get('status')
  async checkStatus() {
    return this.checkLealStatusUseCase.execute();
  }

  @Get('credentials')
  async getCredentials() {
    return this.lealRepository.getCredentials();
  }

  @Put('credentials')
  async updateCredentials(@Body() body: { user: string; pass: string }) {
    await this.lealRepository.updateCredentials(body.user, body.pass);
    return { success: true };
  }

  @Get('customers/search')
  async searchCustomer(
    @Query('q') query: string,
    @Query('soloCedula') soloCedula: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.split(' ')[1] || '';
    // If frontend doesn't send soloCedula, default to 's'
    const sc = soloCedula || 's';
    const customer = await this.searchLealCustomerUseCase.execute(
      query,
      sc,
      token,
    );
    return { data: customer ? [customer] : [] };
  }

  @Get('customers/:uid')
  async getCustomerByUid(
    @Param('uid') uid: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.split(' ')[1] || '';
    // uid is definitely an internal ID or something similar, so soloCedula='n' could be used, or just 's'
    const customer = await this.searchLealCustomerUseCase.execute(
      uid,
      'n',
      token,
    );
    return { data: customer };
  }

  @Get('customers/:uid/premios')
  async getPremios(
    @Param('uid') uid: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.split(' ')[1] || '';
    const premios = (await this.lealRepository.getPremios(
      uid,
      token,
    )) as LealApiData[];
    return { data: premios };
  }

  @Post('accumulate')
  async accumulatePoints(
    @Body() body: AccumulatePointsBody,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.split(' ')[1] || '';
    const result = (await this.accumulatePointsUseCase.execute({
      customerId: body.uid || body.customerId || '',
      invoiceNo: body.factura || body.invoiceNo || '',
      total: Number(body.valor || body.total || 0),
      token,
    })) as LealApiData;
    return result;
  }

  @Post('redeem')
  async redeemPoints(
    @Body() body: RedeemPointsBody,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.split(' ')[1] || '';
    const result = (await this.redeemPointsUseCase.execute({
      customerId: body.uid || body.customerId || '',
      points: Number(body.puntos || body.points || 0),
      invoiceNo: body.factura || body.invoiceNo || '',
      token,
      idPremio: body.idPremio || body.id_premio,
      otp: body.otp || body.OTP,
      pin: body.pin,
      nota: body.nota,
    })) as LealApiData;
    return result;
  }

  @Post('otp/generate')
  async generateOtp(@Body() body: GenerateOtpBody) {
    return this.lealRepository.generateOtp(
      body.uid || '',
      body.idPremio ?? body.id_premio,
      body.idSucursal ?? body.id_sucursal,
    ) as Promise<LealApiData>;
  }

  @Post('customers/register')
  async registerCustomer(
    @Body() body: RegisterCustomerBody,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = authHeader?.split(' ')[1] || '';
    return this.registerLealCustomerUseCase.execute({
      documentId: body.documentId || '',
      name: body.name || '',
      email: body.email || '',
      phone: body.phone || '',
      token,
    });
  }
}
