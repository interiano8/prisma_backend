import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaProgramacionRepositoryImpl } from '../../persistence/repositories/media-programacion-repository';
import { ProgramacionMediaUseCase } from '../../../application/use-cases/media/programacion-media.use-case';

@Module({
  controllers: [MediaController],
  providers: [
    { provide: 'ProgramacionMediaRepository', useClass: MediaProgramacionRepositoryImpl },
    ProgramacionMediaUseCase,
  ],
})
export class MediaModule {}