import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Config } from './entities/config.entity';
import { Division } from './entities/division.entity';
import { GenesysService } from '../genesys/genesys.service';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: getRepositoryToken(Config), useValue: {} },
        { provide: getRepositoryToken(Division), useValue: {} },
        { provide: GenesysService, useValue: {} },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
