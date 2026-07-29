import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePasswordService } from './update-password.service';
import { UserService } from '../user/user.service';

describe('UpdatePasswordService', () => {
  let service: UpdatePasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatePasswordService,
        { provide: UserService, useValue: {} },
      ],
    }).compile();

    service = module.get<UpdatePasswordService>(UpdatePasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
