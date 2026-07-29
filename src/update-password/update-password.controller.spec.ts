import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../user/jwt-auth.guard';
import { UpdatePasswordController } from './update-password.controller';
import { UpdatePasswordService } from './update-password.service';

describe('UpdatePasswordController', () => {
  let controller: UpdatePasswordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UpdatePasswordController],
      providers: [{ provide: UpdatePasswordService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UpdatePasswordController>(UpdatePasswordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
