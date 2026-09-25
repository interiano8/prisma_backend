import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class InvoiceItemDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsNumber()
  qty!: number;

  @IsNotEmpty()
  @IsNumber()
  price!: number;

  @IsNotEmpty()
  @IsNumber()
  tax!: number;

  @IsNotEmpty()
  @IsNumber()
  discount!: number;

  @IsNotEmpty()
  @IsNumber()
  total!: number;

  @IsOptional()
  @IsNumber()
  saleId?: number;

  @IsOptional()
  @IsNumber()
  discountPercentage?: number;
}

export interface LealPaymentData {
  uid: string;
  puntos?: number;
  idPremio?: number;
  otp?: string;
  customerDocumentId?: string;
  cedula?: string;
  customerName?: string;
}

class InvoicePaymentDto {
  @IsNotEmpty()
  @IsString()
  method!: string;

  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  lealData?: LealPaymentData;
}

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  storeId!: string;

  @IsNotEmpty()
  @IsString()
  posNo!: string;

  @IsNotEmpty()
  @IsString()
  shiftNumber!: string;

  @IsNotEmpty()
  @IsString()
  customerNo!: string;

  @IsNotEmpty()
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  customerRtn?: string;

  @IsOptional()
  @IsString()
  shiftDate?: string;

  @IsOptional()
  @IsString()
  employeeName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoicePaymentDto)
  payments!: InvoicePaymentDto[];

  @IsNotEmpty()
  @IsNumber()
  total!: number;

  @IsNotEmpty()
  @IsNumber()
  tax!: number;

  @IsNotEmpty()
  @IsNumber()
  discount!: number;

  @IsOptional()
  isTicket?: boolean;

  @IsOptional()
  isCredit?: boolean;

  @IsOptional()
  @IsString()
  km?: string;

  @IsOptional()
  @IsString()
  orden?: string;

  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  chofer?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  lealIdAleatorioAcum?: string;

  @IsOptional()
  @IsString()
  lealIdAleatorioRed?: string;

  @IsOptional()
  @IsString()
  lealCustomerUid?: string;

  @IsOptional()
  @IsString()
  lealCustomerName?: string;

  @IsOptional()
  @IsString()
  lealCustomerDni?: string;

  @IsOptional()
  @IsString()
  lealPin?: string;

  @IsOptional()
  @IsBoolean()
  permitirFacturarSinAcumular?: boolean;

  @IsOptional()
  @IsBoolean()
  omitirAcumulacion?: boolean;
}
