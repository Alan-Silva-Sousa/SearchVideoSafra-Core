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
    let token: string | undefined;

    if (typeof authHeader === 'string') {
      const [scheme, headerToken, ...extra] = authHeader.trim().split(/\s+/);
      if (scheme !== 'Bearer' || !headerToken || extra.length > 0) {
        throw new UnauthorizedException('Token inválido');
      }
      token = headerToken;
    } else if (typeof request.headers.cookie === 'string') {
      const cookie = request.headers.cookie
        .split(';')
        .map((item: string) => item.trim())
        .find((item: string) => item.startsWith('searchaudio_token='));
      token = cookie
        ? decodeURIComponent(cookie.slice('searchaudio_token='.length))
        : undefined;
    }

    if (!token) throw new UnauthorizedException('Token não fornecido');

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
