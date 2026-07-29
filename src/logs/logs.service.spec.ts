import { Test, TestingModule } from '@nestjs/testing';
import { LogsService } from './logs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Log } from './entities/log.entity';

describe('LogsService', () => {
  let service: LogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: getRepositoryToken(Log), useValue: {} },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
