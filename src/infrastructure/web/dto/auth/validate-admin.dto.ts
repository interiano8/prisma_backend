import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateAdminDto {
  @IsNotEmpty()
  @IsString()
  storeId: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
