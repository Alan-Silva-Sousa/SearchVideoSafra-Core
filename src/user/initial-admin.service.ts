import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { UserService } from './user.service';

@Injectable()
export class InitialAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitialAdminService.name);

  constructor(private readonly userService: UserService) {}

  async onApplicationBootstrap() {
    if ((process.env.AUTH_METHOD || 'local') !== 'local') return;

    const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    if (!email || !password) {
      this.logger.warn('Administrador inicial não configurado');
      return;
    }

    const existing = await this.userService.findByEmail(email);
    if (!existing) {
      await this.userService.createUser(
        email,
        password,
        'admin',
        'Administrador',
      );
      this.logger.log(`Administrador inicial criado: ${email}`);
    }
  }
}
