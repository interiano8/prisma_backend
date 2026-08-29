import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class OpenShiftDto {
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
  initialAmount!: number;

  @IsOptional()
  @IsNumber()
  shiftNumber?: number;
}
