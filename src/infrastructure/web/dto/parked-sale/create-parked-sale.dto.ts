import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateParkedSaleDto {
  @IsString()
  @IsNotEmpty()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  posNo: string;

  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsString()
  @IsNotEmpty()
  turnoId: string;

  @IsOptional()
  cliente?: any;

  @IsArray()
  items: any[];

  @IsString()
  @IsOptional()
  nota?: string;

  @IsNumber()
  total: number;
}
