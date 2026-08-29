import {
  ShiftInfo,
  OpenShiftCommand,
  CloseShiftCommand,
} from '../../entities/shift.entity';

export interface ShiftUseCase {
  getOpenShift(
    storeId: string,
    posNo: string,
    employeeName: string,
  ): Promise<ShiftInfo>;
  openShift(dto: OpenShiftCommand): Promise<ShiftInfo>;
  closeShift(dto: CloseShiftCommand): Promise<{ success: boolean }>;
}
