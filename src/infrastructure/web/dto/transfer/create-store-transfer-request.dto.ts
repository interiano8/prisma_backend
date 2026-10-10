import { IsNotEmpty, IsString, IsOptional, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferRequestItemDto {
  @IsNotEmpty()
  @IsString()
  productCode!: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsNumber()
  quantity!: number;
}

export class CreateStoreTransferRequestDto {
  @IsNotEmpty()
  @IsString()
  fromStoreCode!: string;

  @IsOptional()
  @IsString()
  toStoreCode?: string;

  @IsOptional()
  @IsString()
  requestedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferRequestItemDto)
  items!: TransferRequestItemDto[];
}
