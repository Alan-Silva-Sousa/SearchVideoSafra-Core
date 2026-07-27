import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AudioService } from './gravacao.service';
import { Gravacao } from './entities/gravacao.entity';
import { FilesystemService } from '../filesystem.service';

describe('AudioService', () => {
  let service: AudioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioService,
        { provide: getRepositoryToken(Gravacao), useValue: {} },
        { provide: FilesystemService, useValue: {} },
      ],
    }).compile();

    service = module.get<AudioService>(AudioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
