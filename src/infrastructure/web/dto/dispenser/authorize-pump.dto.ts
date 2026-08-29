import { IsNotEmpty, IsNumber } from 'class-validator';

export class AuthorizePumpDto {
  @IsNotEmpty()
  @IsNumber()
  pumpId!: number;

  @IsNotEmpty()
  @IsNumber()
  limitAmount!: number;
}
