import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { GetPosConfigUseCase } from '../../../application/use-cases/pos-config/get-pos-config.use-case';
import { UpdatePosConfigUseCase } from '../../../application/use-cases/pos-config/update-pos-config.use-case';

@Controller('pos-config')
export class PosConfigController {
  constructor(
    private readonly getPosConfigUseCase: GetPosConfigUseCase,
    private readonly updatePosConfigUseCase: UpdatePosConfigUseCase,
  ) {}

  @Get(':posNo')
  async get(@Param('posNo') posNo: string) {
    return this.getPosConfigUseCase.execute(posNo);
  }

  @Put(':posNo')
  async update(
    @Param('posNo') posNo: string,
    @Body()
    body: {
      mostrarBombas?: boolean;
      numTransaccionesBombas?: number;
      minutosAtrasada?: number;
      mostrarTeclado?: boolean;
      declararMontosIniciales?: boolean;
      visualizacion?: string;
    },
  ) {
    return this.updatePosConfigUseCase.execute(posNo, body);
  }
}
