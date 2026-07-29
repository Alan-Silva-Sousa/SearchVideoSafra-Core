import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { GenesysStrategy } from './strategies';

export interface AuthConfig {
  authMethod: 'genesys';
  genesysAuthUrl: string;
}

@Injectable()
export class AuthService {
  private readonly pkceVerifiers = new Map<
    string,
    { codeVerifier: string; expiresAt: number }
  >();
  private readonly oauthStateTtlMs = 5 * 60 * 1000;

  constructor(
    private jwtService: JwtService,
    private genesysStrategy: GenesysStrategy,
  ) {}

  getAuthConfig(): AuthConfig {
    this.deleteExpiredPkceVerifiers();

    const nonce = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    this.pkceVerifiers.set(nonce, {
      codeVerifier,
      expiresAt: Date.now() + this.oauthStateTtlMs,
    });

    const state = this.jwtService.sign(
      { purpose: 'genesys-oauth', nonce },
      { expiresIn: '5m' },
    );

    return {
      authMethod: 'genesys',
      genesysAuthUrl: this.genesysStrategy.getAuthorizationUrl(
        state,
        codeChallenge,
      ),
    };
  }

  async handleGenesysCallback(code: string, state: string) {
    const codeVerifier = this.consumePkceVerifier(state);
    const result = await this.genesysStrategy.authenticate({
      code,
      codeVerifier,
    });

    if (!result.success || !result.user) {
      throw new UnauthorizedException(
        result.error || 'Erro ao autenticar com Genesys',
      );
    }

    const payload = {
      sub: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      authProvider: result.user.authProvider,
    };

    return {
      token: this.jwtService.sign(payload),
      email: result.user.email,
      displayName: result.user.displayName,
    };
  }

  private consumePkceVerifier(state: string): string {
    this.deleteExpiredPkceVerifiers();

    try {
      const payload = this.jwtService.verify<{
        purpose?: string;
        nonce?: string;
      }>(state);
      if (payload.purpose !== 'genesys-oauth' || !payload.nonce) {
        throw new Error('Invalid OAuth state purpose');
      }

      const entry = this.pkceVerifiers.get(payload.nonce);
      this.pkceVerifiers.delete(payload.nonce);

      if (!entry || entry.expiresAt <= Date.now()) {
        throw new Error('Missing, expired, or replayed OAuth state');
      }

      return entry.codeVerifier;
    } catch {
      throw new UnauthorizedException('Estado OAuth inválido ou expirado');
    }
  }

  private deleteExpiredPkceVerifiers(): void {
    const now = Date.now();
    for (const [nonce, entry] of this.pkceVerifiers) {
      if (entry.expiresAt <= now) {
        this.pkceVerifiers.delete(nonce);
      }
    }
  }
}
