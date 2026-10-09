import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NuevoMetodoPagoDto {
  @IsNotEmpty()
  @IsString()
  codigoMetodoPago!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  referencia?: string;
}

export class NuevoClienteDto {
  @IsNotEmpty()
  @IsString()
  codigo!: string;

  @IsNotEmpty()
  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  rtn?: string;
}

export class ReclassifySaleDto {
  @IsNotEmpty()
  @IsString()
  storeId!: string;

  @IsNotEmpty()
  @IsString()
  posNo!: string;

  @IsNotEmpty()
  @IsString()
  adminPin!: string;

  @IsOptional()
  @IsString()
  supervisorUser?: string;

  @IsNotEmpty()
  @IsString()
  requestedByUser!: string;

  @IsNotEmpty()
  @IsString()
  motivo!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NuevoMetodoPagoDto)
  nuevoMetodoPago?: NuevoMetodoPagoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NuevoClienteDto)
  nuevoCliente?: NuevoClienteDto;
}
