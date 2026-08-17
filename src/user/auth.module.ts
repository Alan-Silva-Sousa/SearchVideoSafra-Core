import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GenesysStrategy } from './strategies';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET não foi configurado no arquivo .env');
        }

        return {
          secret,
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
    AccessModule,
  ],
  providers: [AuthService, UserService, JwtAuthGuard, GenesysStrategy],
  controllers: [AuthController],
  exports: [JwtAuthGuard, JwtModule, UserService],
})
export class AuthModule {}
