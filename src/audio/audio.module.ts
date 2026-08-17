import { Module } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AudioController } from './audio.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gravacao } from './entities/gravacao.entity';
import { S3Service } from '../storage/s3.service';
import { CanonicalVideoService } from './canonical-video.service';
import { AuthModule } from '../user/auth.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [TypeOrmModule.forFeature([Gravacao]), AuthModule, AccessModule],
  controllers: [AudioController],
  providers: [AudioService, S3Service, CanonicalVideoService],
})
export class AudioModule {}
