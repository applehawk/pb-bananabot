import { Test, TestingModule } from '@nestjs/testing';
import { OutlineBackendController } from './outline-backend.controller';

describe('OutlineBackendController', () => {
  let controller: OutlineBackendController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OutlineBackendController],
    }).compile();

    controller = module.get<OutlineBackendController>(OutlineBackendController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
