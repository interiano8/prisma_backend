import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRfidDto {
  @IsNotEmpty()
  @IsString()
  rfidCode!: string;

  @IsNotEmpty()
  @IsString()
  posNo!: string;

  @IsNotEmpty()
  @IsString()
  storeId!: string;
}
