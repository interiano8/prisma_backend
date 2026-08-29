import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { CreateCustomerDto } from '../dto/customer/create-customer.dto';
import { SearchCustomersUseCase } from '../../../application/use-cases/customer/search-customers.use-case';
import { GetConsumidorFinalUseCase } from '../../../application/use-cases/customer/get-consumidor-final.use-case';
import { CreateCustomerUseCase } from '../../../application/use-cases/customer/create-customer.use-case';
import { GetCustomerByCodeUseCase } from '../../../application/use-cases/customer/get-customer-by-code.use-case';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly searchCustomersUseCase: SearchCustomersUseCase,
    private readonly getConsumidorFinalUseCase: GetConsumidorFinalUseCase,
    private readonly getCustomerByCodeUseCase: GetCustomerByCodeUseCase,
  ) {}

  @Post('create')
  async create(@Body() dto: CreateCustomerDto) {
    return this.createCustomerUseCase.execute(dto);
  }

  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('creditOnly') creditOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.searchCustomersUseCase.execute(
      q,
      creditOnly === 'true',
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get('cf')
  async getConsumidorFinal() {
    return this.getConsumidorFinalUseCase.execute();
  }

  @Get('by-code/:code')
  async getByCode(@Param('code') code: string) {
    return this.getCustomerByCodeUseCase.execute(code);
  }
}
