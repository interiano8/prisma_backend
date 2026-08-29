import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CloseShiftDto {
  @IsNotEmpty()
  @IsString()
  storeId!: string;

  @IsNotEmpty()
  @IsString()
  posNo!: string;

  @IsNotEmpty()
  @IsString()
  employeeName!: string;

  @IsNotEmpty()
  @IsNumber()
  actualAmount!: number;

  @IsOptional()
  @IsString()
  type?: string = 'S';
}
