import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Autenticação')
@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('auth/config')
  @ApiOperation({
    summary: 'Configuração de autenticação',
    description: 'Retorna a URL de autenticação do Genesys Cloud',
  })
  @ApiResponse({ status: 200, description: 'Configuração retornada' })
  getAuthConfig() {
    return this.authService.getAuthConfig();
  }

  @Get('auth/genesys/callback')
  @ApiOperation({
    summary: 'Callback OAuth Genesys',
    description:
      'Processa o callback do Genesys Cloud e redireciona para o frontend',
  })
  @ApiQuery({
    name: 'code',
    description: 'Authorization code do OAuth',
    required: true,
  })
  @ApiQuery({
    name: 'state',
    description: 'Estado assinado do fluxo OAuth',
    required: true,
  })
  @ApiResponse({
    status: 302,
    description: 'Redireciona para o callback do frontend',
  })
  async genesysCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    const frontUrl = (process.env.FRONT_URL || 'http://localhost:5173').replace(
      /\/$/,
      '',
    );

    try {
      if (!code || !state) {
        throw new Error('Code e state são obrigatórios');
      }

      const result = await this.authService.handleGenesysCallback(code, state);
      response.cookie('searchaudio_token', result.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
      const fragment = new URLSearchParams({
        token: result.token,
        email: result.email,
        displayName: result.displayName || '',
      });
      return response.redirect(
        `${frontUrl}/#/auth/callback?${fragment.toString()}`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro de autenticação';
      const fragment = new URLSearchParams({ error: message });
      return response.redirect(
        `${frontUrl}/#/auth/callback?${fragment.toString()}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/session')
  getSession(@Req() request: Request & { user: Record<string, unknown> }) {
    return { authenticated: true, user: request.user };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('auth/me')
  getCurrentUser(@Req() request: Request & { user: Record<string, unknown> }) {
    return request.user;
  }
}
