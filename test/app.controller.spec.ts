import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: { getHello: () => 'Hola' } },
      ],
    }).compile();

    controller = module.get(AppController);
  });

  it('getHello delega en AppService', () => {
    expect(controller.getHello()).toBe('Hola');
  });
});
