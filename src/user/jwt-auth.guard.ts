import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (typeof authHeader !== 'string') {
      throw new UnauthorizedException('Token não fornecido');
    }

    const [scheme, token, ...extra] = authHeader.trim().split(/\s+/);

    if (scheme !== 'Bearer' || !token || extra.length > 0) {
      throw new UnauthorizedException('Token inválido');
    }

    let payload;

    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    if (payload.authProvider !== 'genesys') {
      throw new UnauthorizedException('Provedor não autorizado');
    }

    request.user = payload;
    return true;
  }
}
