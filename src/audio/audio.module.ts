import { Module } from '@nestjs/common';
import { AudioService } from './gravacao.service';
import { AudioController } from './audio.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gravacao } from './entities/gravacao.entity';
import { FilesystemService } from '../filesystem.service';
import { AuthModule } from '../user/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gravacao]),
    AuthModule,
  ],
  controllers: [AudioController],
  providers: [AudioService, FilesystemService],
})
export class AudioModule {}
