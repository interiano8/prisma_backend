import { User } from '../../entities/user.entity';
import { StoreConfig } from '../../entities/store-config.entity';
import { ShiftInfo } from '../../entities/shift.entity';

export interface LoginRequest {
  username: string;
  password: string;
  posNo: string;
  storeId: string;
}

export interface LoginRfidRequest {
  rfidCode: string;
  posNo: string;
  storeId: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  storeConfig: StoreConfig;
  shiftInfo: ShiftInfo;
}

export interface AuthUseCase {
  login(dto: LoginRequest): Promise<LoginResponse>;
  loginWithRfid(dto: LoginRfidRequest): Promise<LoginResponse>;
}
