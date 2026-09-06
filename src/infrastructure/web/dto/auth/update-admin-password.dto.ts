import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateAdminPasswordDto {
  @IsNotEmpty()
  @IsString()
  storeId: string;

  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  newPassword: string;
}