import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { AuditRequest } from '../audit/audit.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private auditService: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const authHeader = request.headers['authorization'];
    let token: string | undefined;

    if (typeof authHeader === 'string') {
      const [scheme, headerToken, ...extra] = authHeader.trim().split(/\s+/);
      if (scheme !== 'Bearer' || !headerToken || extra.length > 0) {
        return this.reject(request, 'ACCESS_DENIED', 'INVALID_AUTHORIZATION_HEADER');
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

    if (!token) return this.reject(request, 'ACCESS_DENIED', 'TOKEN_NOT_PROVIDED');

    let payload;

    try {
      payload = this.jwtService.verify(token);
    } catch {
      return this.reject(request, 'SESSION_EXPIRED', 'TOKEN_INVALID_OR_EXPIRED');
    }

    if (payload.authProvider !== 'genesys') {
      return this.reject(request, 'ACCESS_DENIED', 'AUTH_PROVIDER_NOT_ALLOWED');
    }

    request.user = payload;
    return true;
  }

  private async reject(request: AuditRequest, action: 'ACCESS_DENIED' | 'SESSION_EXPIRED', reason: string): Promise<never> {
    await this.auditService.record(request, { action, result: 'BLOCKED', details: { reason } });
    throw new UnauthorizedException(action === 'SESSION_EXPIRED' ? 'Token inválido ou expirado' : 'Acesso não autorizado');
  }
}
