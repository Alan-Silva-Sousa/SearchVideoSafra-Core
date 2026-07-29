import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gravacao } from './entities/gravacao.entity';
import { S3Service } from '../storage/s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([Gravacao])],
  controllers: [AudioController],
  providers: [AudioService, S3Service],
})
export class AudioModule {}
